import { describe, it, expect, mock } from 'bun:test';
import { createHash } from 'crypto';
import pino from 'pino';
import {
  createRedisPresenceStore,
  presenceKey,
  PRESENCE_KEY_PREFIX,
} from '../../../src/realtime/presenceStore';
import type { RedisManager, RedisOutcome } from '../../../src/utils/redis';

interface RecordedCommand {
  command: string;
  args: string[];
}

/**
 * A `RedisManager` that records what it was asked and answers from a script.
 *
 * Deliberately not a Redis simulator. What this tier can honestly check is the
 * *protocol* — which command, which key, which arguments, and how a reply is
 * mapped back — because that is what this module writes. Whether `HPEXPIRE`
 * really expires a field, and whether `HLEN` really excludes an expired one,
 * are Redis's promises and are pinned against a real server in
 * `tests/integration/realtime/presenceStore.test.ts`.
 */
const makeRedis = (replies: unknown[] | ((call: RecordedCommand) => unknown)) => {
  const calls: RecordedCommand[] = [];
  let index = 0;
  const redis = {
    async command<T>(command: string, args: string[] = []): Promise<RedisOutcome<T>> {
      const call = { command, args };
      calls.push(call);
      const reply = typeof replies === 'function' ? replies(call) : replies[index++];
      if (reply instanceof Error) return { ok: false, error: reply };
      return { ok: true, value: reply as T };
    },
  } as unknown as RedisManager;
  return { redis, calls };
};

const makeStore = (redis: RedisManager, logger?: pino.Logger) =>
  createRedisPresenceStore({ redis, instanceId: 'alpha', ttlMs: 30_000, logger });

/** The rejection Redis sends for a digest it does not have cached. */
const noScript = new Error('NOSCRIPT No matching script. Please use EVAL.');

/**
 * Answers the first `EVALSHA` with a cache miss and the following `EVAL` with
 * `reply`, which is the round trip every script makes against a server that has
 * not seen it yet.
 */
const missThenLoad = (reply: unknown) => (call: RecordedCommand) =>
  call.command === 'EVALSHA' ? noScript : reply;

describe('redis presence store', () => {
  it('takes a lease and reports how many instances held one before', async () => {
    const { redis, calls } = makeRedis([2]);
    const store = makeStore(redis);

    const result = await store.hold('user-1', 3);

    expect(result).toEqual({ ok: true, value: 2 });
    // One round trip, so nothing loads the script ahead of time: a `SCRIPT
    // LOAD` at construction would also break `asks nothing at all for an empty
    // page` below.
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('EVALSHA');
    const [sha, numkeys, key, instanceId, ttl, connections] = calls[0].args;
    // Named by digest rather than by body — that is the whole point of the
    // command; the body itself is asserted on the fallback below.
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(numkeys).toBe('1');
    expect(key).toBe(`${PRESENCE_KEY_PREFIX}user-1`);
    expect(instanceId).toBe('alpha');
    expect(ttl).toBe('30000');
    expect(connections).toBe('3');
  });

  it('sends the body when the server has dropped the script, and returns its reply', async () => {
    const { redis, calls } = makeRedis(missThenLoad(2));
    const store = makeStore(redis);

    expect(await store.hold('user-1', 3)).toEqual({ ok: true, value: 2 });

    expect(calls.map((c) => c.command)).toEqual(['EVALSHA', 'EVAL']);
    const [script, ...rest] = calls[1].args;
    // Everything after the script is what the digest was sent with, so a miss
    // is invisible to the caller.
    expect(rest).toEqual(calls[0].args.slice(1));
    // The write and the count that decides the online edge have to be one
    // operation; see the comment on HOLD_SCRIPT.
    expect(script).toContain('HLEN');
    expect(script).toContain('HSET');
    expect(script).toContain('HPEXPIRE');
    // A script is atomic but not transactional: an `HPEXPIRE` that fails on an
    // older server would otherwise leave the `HSET` behind as a lease that never
    // expires. See the integration tier, which proves both halves against a real
    // Redis.
    expect(script).toContain('redis.pcall');
    expect(script).toContain('HDEL');
  });

  it('sends each script under its own digest', async () => {
    // A digest paired with the wrong body would still work — every call would
    // just miss and fall back for ever — so nothing but this comparison would
    // notice. The integration tier proves the digests match the server's.
    const seen = async (run: (store: ReturnType<typeof makeStore>) => Promise<unknown>) => {
      const { redis, calls } = makeRedis(missThenLoad(0));
      await run(makeStore(redis));
      return { sha: calls[0].args[0], body: calls[1].args[0] };
    };

    for (const { sha, body } of [
      await seen((store) => store.hold('user-1', 1)),
      await seen((store) => store.release('user-1')),
      await seen((store) => store.areOnline(['user-1'])),
    ]) {
      expect(sha).toBe(createHash('sha1').update(body).digest('hex'));
    }
  });

  it('does not resend the body for a failure that is not a cache miss', async () => {
    const { redis, calls } = makeRedis(() => new Error('ERR unknown command HPEXPIRE'));
    const result = await makeStore(redis).hold('user-1', 1);

    // Redis refuses an unknown digest before running anything, which is what
    // makes resending safe. Any other failure may have run the script already,
    // and `HOLD_SCRIPT` counts its own field on a second run — see the comment
    // on `evalScript`.
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
  });

  it('drops the lease and reports who is left', async () => {
    const { redis, calls } = makeRedis(missThenLoad(0));
    const store = makeStore(redis);

    expect(await store.release('user-1')).toEqual({ ok: true, value: 0 });
    expect(calls[0].command).toBe('EVALSHA');
    expect(calls[0].args[2]).toBe(presenceKey('user-1'));
    expect(calls[0].args[3]).toBe('alpha');
    expect(calls[1].args[0]).toContain('HDEL');
  });

  it('reads one user with HLEN, not EXISTS', async () => {
    const { redis, calls } = makeRedis([1]);
    const store = makeStore(redis);

    expect(await store.isOnline('user-1')).toEqual({ ok: true, value: true });
    expect(calls[0]).toEqual({ command: 'HLEN', args: [presenceKey('user-1')] });
  });

  it('treats a hash whose fields have all expired as offline', async () => {
    const { redis } = makeRedis([0]);
    expect(await makeStore(redis).isOnline('user-1')).toEqual({ ok: true, value: false });
  });

  it('resolves a whole page of users in one round trip', async () => {
    const { redis, calls } = makeRedis([[1, 0, 2]]);
    const store = makeStore(redis);

    const result = await store.areOnline(['user-1', 'user-2', 'user-3']);

    expect(result.ok && [...result.value].sort()).toEqual(['user-1', 'user-3']);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[1]).toBe('3');
    expect(calls[0].args.slice(2)).toEqual([
      presenceKey('user-1'),
      presenceKey('user-2'),
      presenceKey('user-3'),
    ]);
  });

  it('collapses a repeated user rather than asking about them twice', async () => {
    const { redis, calls } = makeRedis([[1]]);
    const store = makeStore(redis);

    const result = await store.areOnline(['user-1', 'user-1']);

    expect(result.ok && [...result.value]).toEqual(['user-1']);
    expect(calls[0].args[1]).toBe('1');
  });

  it('asks nothing at all for an empty page', async () => {
    const { redis, calls } = makeRedis([]);
    const result = await makeStore(redis).areOnline([]);

    expect(result).toEqual({ ok: true, value: new Set<string>() });
    expect(calls).toHaveLength(0);
  });

  it('walks the scan cursor to the end and confirms every candidate', async () => {
    const pages: Record<string, [string, string[]]> = {
      '0': ['17', [`${PRESENCE_KEY_PREFIX}user-1`, `${PRESENCE_KEY_PREFIX}user-2`]],
      // SCAN is allowed to hand back a key it already returned, and a key whose
      // last field has expired but has not been collected yet.
      '17': ['0', [`${PRESENCE_KEY_PREFIX}user-1`, `${PRESENCE_KEY_PREFIX}user-3`]],
    };
    const { redis, calls } = makeRedis((call) => {
      if (call.command === 'SCAN') return pages[call.args[0]];
      if (call.command === 'HLEN') return call.args[0].endsWith('user-3') ? 0 : 1;
      return 0;
    });

    const result = await makeStore(redis).onlineUsers();

    expect(result.ok && [...result.value].sort()).toEqual(['user-1', 'user-2']);
    const scans = calls.filter((c) => c.command === 'SCAN');
    expect(scans).toHaveLength(2);
    expect(scans[0].args).toEqual(['0', 'MATCH', `${PRESENCE_KEY_PREFIX}*`, 'COUNT', '200']);
    expect(scans[1].args[0]).toBe('17');
  });

  it('reports a failed lease rather than pretending it landed', async () => {
    const { redis } = makeRedis([new Error('ERR unknown command HPEXPIRE')]);
    const result = await makeStore(redis).hold('user-1', 1);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain('HPEXPIRE');
  });

  it('names the Redis version requirement once, not once per connected user', async () => {
    const lines: string[] = [];
    const logger = pino(
      { level: 'warn' },
      { write: (line: string) => lines.push(line) } as pino.DestinationStream,
    );
    const { redis, calls } = makeRedis(() => new Error('ERR unknown command HPEXPIRE'));
    const store = makeStore(redis, logger);

    await store.hold('user-1', 1);
    await store.hold('user-2', 1);
    await store.release('user-3');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('7.4');
    // Three operations, three commands: an old server is not a cache miss, so
    // none of them is retried with the body.
    expect(calls).toHaveLength(3);
  });
});

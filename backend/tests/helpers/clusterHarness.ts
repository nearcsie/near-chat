import path from 'path';
import { RedisClient } from 'bun';
import { realtimeChannel } from '../../src/realtime/redisAdapter';

/**
 * Two real backend instances, one Redis, one PostgreSQL — and a tap on the
 * Redis link of exactly one of them.
 *
 * Why processes rather than two `Server`s in this one. `realtime/presence.ts`
 * keeps its tracker in a module-level `current`, and `bootstrap/presence.ts`
 * replaces it through `configurePresence`, stopping whatever was there before.
 * A second in-process "instance" would therefore not get a presence tracker of
 * its own, it would take the first one's away. `bootstrap/realtime.ts` does not
 * pass `presence` into `attachSockets` either, so the socket layer reads that
 * same singleton. Only separate processes give each instance its own.
 *
 * Why a TCP proxy rather than restarting Redis. Cutting Redis itself cuts it
 * for everyone, which is not the failure the adapter documents — that one is a
 * single instance losing its subscriber while another keeps publishing. It
 * would also need Docker control from inside the test, which neither CI
 * (`.github/workflows/ci-database.yml` mounts no Docker socket) nor the dev
 * container guarantees. A proxy in front of one instance is precise, needs no
 * privileges, and is deterministic about when the link is down.
 */

const backendRoot = path.resolve(__dirname, '../..');

/** Poll until `check` passes, then return; throw `describe()` on timeout. */
const until = async (
  check: () => boolean | Promise<boolean>,
  describe: () => string,
  timeoutMs: number,
  intervalMs = 50,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() >= deadline) throw new Error(`Timed out after ${timeoutMs}ms: ${describe()}`);
    await Bun.sleep(intervalMs);
  }
};

/**
 * A free localhost port.
 *
 * Bound and released rather than picked from a fixed range, so two runs on one
 * machine — a developer's and CI's, or two shards — cannot collide on a
 * hardcoded number. The child binds a moment later; the kernel does not hand
 * the same ephemeral port out twice in that window unless something else asks
 * for that exact port.
 */
const reservePort = (): number => {
  const probe = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
  const { port } = probe;
  probe.stop(true);
  return port;
};

type ProxyClient = import('bun').Socket<ProxyClientContext>;
type ProxyUpstream = import('bun').Socket<ProxyUpstreamContext>;

interface ProxyClientContext {
  upstream?: ProxyUpstream;
  /** Frames written before the upstream socket finished connecting. */
  pending: Uint8Array[];
  closed: boolean;
}

interface ProxyUpstreamContext {
  client: ProxyClient;
}

export interface RedisProxy {
  /** What the proxied instance should use as its `REDIS_URL`. */
  readonly url: string;
  /** Drop every live connection and refuse new ones until `heal()`. */
  cut(): void;
  /** Accept connections again. */
  heal(): void;
  stop(): void;
}

/** A TCP proxy in front of Redis whose link can be severed on demand. */
export const startRedisProxy = ({ target }: { target: string }): RedisProxy => {
  const upstream = new URL(target);
  const upstreamPort = Number(upstream.port || 6379);
  const live = new Set<ProxyClient>();
  let severed = false;

  const listener = Bun.listen<ProxyClientContext>({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open(client) {
        client.data = { pending: [], closed: false };
        if (severed) {
          // `terminate` rather than `end`: a FIN would let the client believe
          // the link was closed politely, where the outage being modelled is
          // the link going away underneath it.
          client.terminate();
          return;
        }
        live.add(client);
        void Bun.connect<ProxyUpstreamContext>({
          hostname: upstream.hostname,
          port: upstreamPort,
          // Supplied up front so the upstream handlers always have their client,
          // including for a frame that lands before `connect` resolves.
          data: { client },
          socket: {
            data(socket, chunk) {
              socket.data.client.write(chunk);
            },
            close(socket) {
              socket.data.client.end();
            },
            error(socket) {
              socket.data.client.end();
            },
          },
        })
          .then((connection) => {
            if (client.data.closed) {
              connection.end();
              return;
            }
            client.data.upstream = connection;
            for (const chunk of client.data.pending) connection.write(chunk);
            client.data.pending = [];
          })
          .catch(() => client.terminate());
      },
      data(client, chunk) {
        const connection = client.data.upstream;
        // A Redis client sends its first command immediately on connect, which
        // can be before the upstream socket exists. Buffered, not dropped.
        if (connection) connection.write(chunk);
        else client.data.pending.push(new Uint8Array(chunk));
      },
      close(client) {
        client.data.closed = true;
        client.data.upstream?.end();
        live.delete(client);
      },
      error(client) {
        client.data.closed = true;
        client.data.upstream?.end();
        live.delete(client);
      },
    },
  });

  return {
    url: `redis://127.0.0.1:${listener.port}`,
    cut() {
      severed = true;
      for (const client of live) client.terminate();
      live.clear();
    },
    heal() {
      severed = false;
    },
    stop() {
      severed = true;
      for (const client of live) client.terminate();
      live.clear();
      listener.stop(true);
    },
  };
};

export interface ClusterInstance {
  readonly instanceId: string;
  readonly port: number;
  /** Base URL for REST calls and Socket.IO clients. */
  readonly url: string;
  /** Everything the process has written, for diagnosing a failure. */
  output(): string;
  stop(): Promise<void>;
}

interface StartInstanceOptions {
  instanceId: string;
  redisUrl: string;
  databaseUrl: string;
  jwtSecret: string;
  clusterId: string;
}

const startInstance = async ({
  instanceId,
  redisUrl,
  databaseUrl,
  jwtSecret,
  clusterId,
}: StartInstanceOptions): Promise<ClusterInstance> => {
  const port = reservePort();
  const child = Bun.spawn(['bun', 'src/index.ts'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL_TEST: databaseUrl,
      // `config/env.ts` reads `REDIS_URL` and never `REDIS_URL_TEST`, so an
      // instance handed only the latter would silently come up with no cluster
      // adapter and no presence store — and every cross-instance assertion here
      // would pass by never having been cross-instance at all.
      REDIS_URL: redisUrl,
      REALTIME_CLUSTER_ID: clusterId,
      JWT_SECRET: jwtSecret,
      PORT: String(port),
      INSTANCE_ID: instanceId,
      // `NODE_ENV=test` would otherwise silence the process entirely; the
      // output is buffered and only surfaced when a wait fails.
      LOG_LEVEL: 'info',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Drained continuously rather than read at the end: a full pipe buffer would
  // block the child mid-write, which looks exactly like a hung instance.
  let output = '';
  const drain = async (stream: ReadableStream<Uint8Array>): Promise<void> => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) output += decoder.decode(chunk, { stream: true });
  };
  void drain(child.stdout).catch(() => {});
  void drain(child.stderr).catch(() => {});

  const url = `http://127.0.0.1:${port}`;
  const instance: ClusterInstance = {
    instanceId,
    port,
    url,
    output: () => output,
    async stop() {
      // Bounded, and always awaited to the end: a child left alive keeps a
      // connection pool on the shared test database, and `index.ts` gives
      // itself a 20s shutdown deadline this must not sit through.
      child.kill('SIGTERM');
      const exit = await Promise.race([child.exited, Bun.sleep(10_000).then(() => 'timeout' as const)]);
      if (exit === 'timeout') {
        child.kill('SIGKILL');
        await child.exited;
      }
    },
  };

  try {
    await until(
      async () => {
        // `exitCode`, not `killed`: a child that died on its own — a port taken
        // between reservation and bind is the realistic one — was never killed,
        // and would otherwise be waited out for the full timeout.
        if (child.exitCode !== null) {
          throw new Error(`${instanceId} exited (code ${child.exitCode}) during startup:\n${output}`);
        }
        try {
          const response = await fetch(`${url}/api/v1/health`);
          return response.ok;
        } catch {
          return false;
        }
      },
      () => `${instanceId} never became healthy on ${url}:\n${output}`,
      30_000,
    );
  } catch (error) {
    await instance.stop();
    throw error;
  }

  return instance;
};

export interface ApiCallOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * One JSON call against an instance's REST API.
 *
 * `tests/helpers/http.ts` drives a Hono app object in this process, which a
 * child cannot be reached through; these instances are only addressable over
 * a real socket.
 */
export const call = async <T>(
  instance: ClusterInstance,
  method: string,
  path: string,
  options: ApiCallOptions = {},
): Promise<{ status: number; body: T }> => {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${instance.url}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: (text ? JSON.parse(text) : undefined) as T,
  };
};

export interface Cluster {
  /** Reaches Redis directly; the instance that keeps publishing. */
  readonly alpha: ClusterInstance;
  /** Reaches Redis through `proxy`; the instance whose link gets cut. */
  readonly beta: ClusterInstance;
  readonly proxy: RedisProxy;
  /** This run's cluster channel, isolated from any other run on the same Redis. */
  readonly channel: string;
  /** How many subscribers this run's channel currently has. */
  subscriberCount(): Promise<number>;
  /** Wait until the channel has exactly `expected` subscribers. */
  waitForSubscribers(expected: number, timeoutMs?: number): Promise<void>;
  stop(): Promise<void>;
}

export interface StartClusterOptions {
  /** Defaults to `REDIS_URL_TEST`, then the dev compose host mapping. */
  redisUrl?: string;
  /** Defaults to `DATABASE_URL_TEST`. */
  databaseUrl?: string;
}

/**
 * Bring up both instances and wait until each has actually subscribed.
 *
 * `/api/v1/health` answering is not that moment: `index.ts` does not await
 * `redis.connect()` before it serves, so the adapter's first `SUBSCRIBE` can
 * fail and be replayed by the watchdog a moment later. Gating on the health
 * endpoint alone would race the very subscription every assertion here depends
 * on. `PUBSUB NUMSUB` on this run's own channel is the fact itself, read from
 * the Redis both instances are talking to.
 */
export const startCluster = async (options: StartClusterOptions = {}): Promise<Cluster> => {
  const redisUrl = options.redisUrl || process.env.REDIS_URL_TEST || 'redis://localhost:6385';
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL_TEST;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_TEST is not set — copy .env.test.example to .env.test');
  }

  const run = `it-${Math.random().toString(36).slice(2, 10)}`;
  const channel = realtimeChannel(run);
  const jwtSecret = `${run}-secret`;

  const observer = new RedisClient(redisUrl);
  await observer.connect();
  const subscriberCount = async (): Promise<number> => {
    const reply = (await observer.send('PUBSUB', ['NUMSUB', channel])) as [string, number | string];
    return Number(reply[1]);
  };

  const proxy = startRedisProxy({ target: redisUrl });
  let alpha: ClusterInstance | undefined;
  let beta: ClusterInstance | undefined;

  const stop = async (): Promise<void> => {
    await Promise.all([alpha?.stop(), beta?.stop()]);
    proxy.stop();
    observer.close();
  };

  try {
    alpha = await startInstance({
      instanceId: `${run}-alpha`,
      redisUrl,
      databaseUrl,
      jwtSecret,
      clusterId: run,
    });
    beta = await startInstance({
      instanceId: `${run}-beta`,
      redisUrl: proxy.url,
      databaseUrl,
      jwtSecret,
      clusterId: run,
    });

    let seen = 0;
    await until(
      async () => (seen = await subscriberCount()) === 2,
      () =>
        `both instances to subscribe to ${channel}; last saw ${seen}\n` +
        `alpha:\n${alpha?.output()}\nbeta:\n${beta?.output()}`,
      30_000,
    );
  } catch (error) {
    await stop();
    throw error;
  }

  return {
    alpha,
    beta,
    proxy,
    channel,
    subscriberCount,
    waitForSubscribers: (expected, timeoutMs = 30_000) =>
      until(
        async () => (await subscriberCount()) === expected,
        () => `${channel} to have ${expected} subscriber(s)`,
        timeoutMs,
      ),
    stop,
  };
};

import { describe, it, expect } from 'bun:test';
import type { SQL } from 'bun';
import { MessageRepository } from '../../../src/models/messageRepository';

const VIEWER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

type ChangeRow = Record<string, unknown>;

/**
 * Tagged-template stand-in for `Bun.SQL`. It records the statement text and the
 * bound values so a test can assert on the projection itself, not only on what
 * the mapper does with handed-in rows.
 */
const makeSql = (rows: ChangeRow[]) => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('?'), values });
    return Promise.resolve(rows);
  };
  return { sql: sql as unknown as SQL, calls };
};

const row = (overrides: ChangeRow = {}): ChangeRow => ({
  change_sequence: '7',
  message_sequence: '3',
  revision: 1,
  change_type: 'created',
  command_id: null,
  message_id: '33333333-3333-4333-8333-333333333333',
  room_id: '44444444-4444-4444-8444-444444444444',
  sender_id: VIEWER,
  content: 'hello',
  is_recalled: false,
  reply_to_id: null,
  sent_at: new Date('2026-09-20T00:00:00Z'),
  sender_user_id: VIEWER,
  sender_name: 'Viewer',
  sender_avatar_url: null,
  sender_deleted_at: null,
  current_is_recalled: false,
  mentions: [],
  attachments: null,
  ...overrides,
});

describe('findChangesForUser command id projection', () => {
  it('scopes the command id to the viewer inside the query itself', async () => {
    const { sql, calls } = makeSql([]);

    await new MessageRepository(sql).findChangesForUser(VIEWER, 0, 100);

    expect(calls).toHaveLength(1);
    expect(calls[0].text).toInclude('CASE WHEN mc.actor_id =');
    expect(calls[0].text).toInclude('THEN mc.command_id END AS command_id');
    // The viewer id is bound, never interpolated, and the CASE reads the same
    // parameter the membership join already filters on.
    expect(calls[0].values).toContain(VIEWER);
    expect(calls[0].text).not.toInclude(VIEWER);
  });

  it('echoes the command id back on the viewer own change', async () => {
    const { sql } = makeSql([row({ command_id: 'command-abc' })]);

    const [change] = await new MessageRepository(sql).findChangesForUser(VIEWER, 0, 100);

    expect(change.commandId).toBe('command-abc');
  });

  it('leaves commandId undefined when the row belongs to someone else', async () => {
    // The CASE has already yielded NULL for another member's command.
    const { sql } = makeSql([row({ command_id: null, sender_id: OTHER, sender_user_id: OTHER })]);

    const [change] = await new MessageRepository(sql).findChangesForUser(VIEWER, 0, 100);

    expect(change.commandId).toBeUndefined();
    expect(change).not.toHaveProperty('commandId');
  });

  it('keeps every other field of the change unchanged', async () => {
    const { sql } = makeSql([row({ command_id: 'command-abc' })]);

    const [change] = await new MessageRepository(sql).findChangesForUser(VIEWER, 0, 100);

    expect(change.changeSequence).toBe(7);
    expect(change.messageSequence).toBe(3);
    expect(change.revision).toBe(1);
    expect(change.changeType).toBe('created');
    expect(change.message.messageId).toBe('33333333-3333-4333-8333-333333333333');
    expect(change.message.content).toBe('hello');
  });
});

describe('isCursorWithinChangeLog', () => {
  it('asks the log for both of its ends in one query', async () => {
    const { sql, calls } = makeSql([{ min_seq: 1, max_seq: 50 }]);

    const result = await new MessageRepository(sql).isCursorWithinChangeLog(42);

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].text.replace(/\s+/g, ' '))
      .toInclude('MIN(change_sequence) AS min_seq, MAX(change_sequence) AS max_seq');
  });

  it('rejects a cursor the log no longer reaches back to', async () => {
    // What `db:seed` leaves behind: `message_changes` emptied by TRUNCATE
    // CASCADE while `realtime_counters` keeps its old high-water mark, so the
    // log resumes above the cursor the client is still holding.
    const { sql } = makeSql([{ min_seq: 100, max_seq: 200 }]);

    expect(await new MessageRepository(sql).isCursorWithinChangeLog(42)).toBe(false);
  });

  it('rejects a cursor above the high-water mark, which an older restore leaves behind', async () => {
    // Sequences at or below 100 still exist here, so asking only about those
    // would call this cursor fine while every change the restore rolled back
    // stays outside the client's `change_sequence > cursor` window.
    const { sql } = makeSql([{ min_seq: 1, max_seq: 50 }]);

    expect(await new MessageRepository(sql).isCursorWithinChangeLog(100)).toBe(false);
  });

  it('accepts a cursor sitting exactly at the head of the log', async () => {
    const { sql } = makeSql([{ min_seq: 1, max_seq: 42 }]);

    expect(await new MessageRepository(sql).isCursorWithinChangeLog(42)).toBe(true);
  });

  it('rejects every cursor while the log is empty', async () => {
    const { sql } = makeSql([{ min_seq: null, max_seq: null }]);

    expect(await new MessageRepository(sql).isCursorWithinChangeLog(42)).toBe(false);
  });

  it('reads the aggregates as numbers when the driver hands back BIGINT strings', async () => {
    const { sql } = makeSql([{ min_seq: '1', max_seq: '50' }]);

    expect(await new MessageRepository(sql).isCursorWithinChangeLog(42)).toBe(true);
  });

  it('answers false rather than throwing when the probe comes back empty', async () => {
    const { sql } = makeSql([]);

    expect(await new MessageRepository(sql).isCursorWithinChangeLog(42)).toBe(false);
  });
});

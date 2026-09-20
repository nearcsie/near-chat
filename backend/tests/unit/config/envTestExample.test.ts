import { describe, it, expect } from 'bun:test';
import path from 'path';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Guards the contract between the test suite and `backend/.env.test.example`.
 *
 * `.env.test` is gitignored and every developer builds it by copying the
 * example, so a variable the suite reads but the example never mentions is
 * invisible until someone follows the documented flow and watches it fail.
 * That is exactly how #652 happened: `REDIS_URL_TEST` lived only in
 * `ci-database.yml` and in the two Redis integration files, so CI stayed green
 * — it sets the variable itself — while `docker compose exec backend bun run
 * test:integration` could not pass for anyone.
 *
 * A `*_TEST` variable is the suite's own switch for "which server do I talk
 * to", so the example is the only place a developer can learn it exists. The
 * check is static: read what the tests ask `process.env` for, read what the
 * example declares, and require the second to cover the first.
 */

const backendRoot = path.resolve(__dirname, '../../..');
const testsRoot = path.join(backendRoot, 'tests');

const thisFile = path.basename(__filename);

/** Every `.ts` file under `tests/`, except this one — it names variables it does not read. */
const testSources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return testSources(full);
    if (!entry.name.endsWith('.ts') || entry.name === thisFile) return [];
    return [full];
  });

/**
 * Only `process.env.X` / `process.env['X']` count as a read. Plain object keys
 * named `DATABASE_URL_TEST` are how `unit/config/env.test.ts` feeds the parser
 * a fixture, which is not a read of the ambient environment.
 */
const readVars = new Set<string>();
for (const file of testSources(testsRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const [, name] of source.matchAll(/process\.env\.([A-Z0-9_]+_TEST)\b/g)) {
    readVars.add(name);
  }
  for (const [, name] of source.matchAll(/process\.env\[['"]([A-Z0-9_]+_TEST)['"]\]/g)) {
    readVars.add(name);
  }
}

/**
 * A commented-out line still counts as declared: the example ships the host
 * address for each variable commented beneath the in-container one, and that is
 * how a developer discovers the variable exists.
 */
const example = readFileSync(path.join(backendRoot, '.env.test.example'), 'utf8');
const declaredVars = new Set(
  [...example.matchAll(/^\s*#?\s*([A-Z0-9_]+)=/gm)].map(([, name]) => name),
);

describe('.env.test.example', () => {
  it('declares every *_TEST variable the suite reads', () => {
    const missing = [...readVars].filter((name) => !declaredVars.has(name)).sort();
    expect(missing).toEqual([]);
  });

  /** Guards the regexes above: a scan that silently matched nothing would pass. */
  it('is compared against a non-empty scan', () => {
    expect(readVars.has('DATABASE_URL_TEST')).toBe(true);
    expect(readVars.has('REDIS_URL_TEST')).toBe(true);
  });
});

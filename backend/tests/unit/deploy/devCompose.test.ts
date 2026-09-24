import { describe, it, expect } from 'bun:test';
import path from 'path';
import { readFileSync } from 'node:fs';

/**
 * Source-level properties of the development stack in `docker-compose.yml`.
 *
 * `scripts/check-compose-invariants.mjs` renders only the prod and release
 * models, so nothing else holds this file to anything. Like the release bundle
 * checks in `releaseComposeRuntime.test.ts`, these read the raw YAML from the
 * checkout and need no Docker — and, like them, they run on the host (as CI
 * does), because the dev backend container has no compose files in it.
 */

const repoRoot = path.resolve(__dirname, '../../../..');

interface ComposeService {
  image?: string;
  profiles?: string[];
  command?: string[];
  ports?: string[];
  environment?: Record<string, string> | string[];
  depends_on?: Record<string, unknown> | string[];
  healthcheck?: { test?: string[] };
}

const devServices = (
  Bun.YAML.parse(readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8')) as {
    services: Record<string, ComposeService>;
  }
).services;

/** Environment as `NAME -> raw value`, whichever of the two Compose forms a service uses. */
const environmentOf = (service: ComposeService): Record<string, string | undefined> => {
  const { environment } = service;
  if (!environment) return {};
  if (!Array.isArray(environment)) return environment;
  return Object.fromEntries(
    environment.map((entry) => {
      const separator = entry.indexOf('=');
      return separator === -1
        ? [entry, undefined]
        : [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
};

describe('dev object storage (seaweedfs)', () => {
  const seaweedfs = devServices.seaweedfs;

  it('is defined, so a rename cannot silently empty this suite', () => {
    expect(seaweedfs).toBeDefined();
  });

  it('pins an exact image version rather than a floating tag', () => {
    expect(seaweedfs?.image).toMatch(/^chrislusf\/seaweedfs:\d+\.\d+$/);
  });

  it('stays out of a plain `docker compose up` until the backend uses it (#687)', () => {
    expect(seaweedfs?.profiles).toEqual(['storage']);
  });

  it('publishes on loopback only, since its credentials are well-known dev values', () => {
    expect(seaweedfs?.ports?.length).toBeGreaterThan(0);
    for (const port of seaweedfs?.ports ?? []) {
      expect(port).toStartWith('127.0.0.1:');
    }
  });

  it('keeps telemetry off', () => {
    expect(seaweedfs?.command).toContain('-master.telemetry=false');
  });

  it('pre-creates the bucket and enforces a key pair, even for a blank value', () => {
    const environment = environmentOf(seaweedfs!);

    // `:-` substitutes the default for an empty value as well as an unset one.
    // With `-`, a blank key pair would put the store into anonymous mode, where
    // any signature is accepted, and a blank bucket would skip pre-creation.
    expect(environment.S3_BUCKET).toMatch(/^\$\{STORAGE_S3_BUCKET:-.+\}$/);
    expect(environment.AWS_ACCESS_KEY_ID).toMatch(/^\$\{STORAGE_S3_ACCESS_KEY_ID:-.+\}$/);
    expect(environment.AWS_SECRET_ACCESS_KEY).toMatch(/^\$\{STORAGE_S3_SECRET_ACCESS_KEY:-.+\}$/);
  });

  it('reports healthy only once the bucket answers a signed request', () => {
    const probe = seaweedfs?.healthcheck?.test?.at(-1) ?? '';

    expect(probe).toInclude('--aws-sigv4');
    expect(probe).toInclude('$${S3_BUCKET}');
    // Without a bucket name the probe would hit the service root instead of a
    // bucket; the guard fails it outright rather than relying on that answer.
    expect(probe).toStartWith('test -n "$${S3_BUCKET}" &&');
  });
});

describe('dev backend storage', () => {
  const backend = devServices.backend;

  it('still stores uploads on the filesystem', () => {
    // Flips to s3 in #687, together with the depends_on below.
    const driver = environmentOf(backend!).STORAGE_DRIVER;
    expect(driver === undefined || driver === 'fs').toBe(true);
  });

  it('does not wait on the object store it does not use yet', () => {
    const dependsOn = backend?.depends_on ?? {};
    const names = Array.isArray(dependsOn) ? dependsOn : Object.keys(dependsOn);
    expect(names).not.toContain('seaweedfs');
  });
});

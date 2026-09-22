import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import {
  isObjectMissingError,
  makeFilesystemStorage,
  type StorageFs,
} from '../../../src/utils/storageService';

describe('filesystem storage driver', () => {
  let root: string;
  let outside: string;
  let storage: ReturnType<typeof makeFilesystemStorage>;

  beforeEach(async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'near-chat-storage-'));
    root = path.join(base, 'uploads', 'attachments');
    outside = path.join(base, 'src');
    await fs.mkdir(outside, { recursive: true });
    storage = makeFilesystemStorage({ root });
  });

  afterEach(async () => {
    await fs.rm(path.dirname(path.dirname(root)), { recursive: true, force: true });
  });

  describe('round trip', () => {
    it('reads back exactly the bytes that were written', async () => {
      const bytes = Buffer.from([0x00, 0xff, 0x10, 0x89, 0x50, 0x4e, 0x47]);

      await storage.put('photo.webp', bytes);
      const handle = await storage.open('photo.webp');

      expect(handle).not.toBeNull();
      expect(Buffer.from(await handle!.arrayBuffer()).equals(bytes)).toBe(true);
    });

    it('creates its own root directory rather than depending on another module', async () => {
      // `root` is deliberately never mkdir-ed by the fixture.
      await storage.put('first.txt', Buffer.from('hello'));

      expect((await fs.stat(root)).isDirectory()).toBe(true);
    });

    it('replaces the bytes when the same key is written twice', async () => {
      await storage.put('same.txt', Buffer.from('first'));
      await storage.put('same.txt', Buffer.from('second'));

      const handle = await storage.open('same.txt');

      expect(await handle!.text()).toBe('second');
    });
  });

  describe('handle', () => {
    it('carries a resolved size and a media type', async () => {
      const bytes = Buffer.from('a'.repeat(1234));
      await storage.put('sized.webp', bytes);

      const handle = await storage.open('sized.webp');

      // A resolved number, not a promise: `new Response(handle)` can only answer
      // with a length if the size is already known. `S3File` declares this as a
      // Promise, so a future driver must adapt rather than pass it straight out.
      expect(typeof handle!.size).toBe('number');
      expect(handle!.size).toBe(1234);
      expect(handle!.type).toInclude('image/webp');
    });
  });

  describe('missing objects', () => {
    it('reports a missing key as null rather than throwing', async () => {
      expect(await storage.open('never-written.txt')).toBeNull();
    });

    it('reports a directory as missing rather than handing back an unreadable handle', async () => {
      await fs.mkdir(path.join(root, 'a-directory'), { recursive: true });

      expect(await storage.open('a-directory')).toBeNull();
    });

    it('treats deleting a missing object as a successful no-op', async () => {
      // Every caller of delete is compensating for an earlier failure; throwing
      // here would mask the failure being compensated for.
      expect(await storage.delete('never-written.txt')).toBeUndefined();
    });

    it('actually removes an object that is there', async () => {
      await storage.put('doomed.txt', Buffer.from('bye'));

      await storage.delete('doomed.txt');

      expect(await storage.open('doomed.txt')).toBeNull();
    });
  });

  describe('error contract', () => {
    // The failure is injected rather than staged with `chmod 000`: this suite is
    // documented to run without Docker, and as root — which CI containers and most
    // dev boxes are — a mode-000 file is still readable, so a permissions fixture
    // would pass for the wrong reason and keep passing after the contract broke.
    const failingFs = (error: NodeJS.ErrnoException): StorageFs => ({
      stat: () => Promise.reject(error),
      rm: () => Promise.reject(error),
      writeFile: () => Promise.reject(error),
      mkdir: () => Promise.resolve(undefined),
    });

    const withCode = (code: string): NodeJS.ErrnoException =>
      Object.assign(new Error(code), { code });

    for (const code of ['EACCES', 'ECONNREFUSED', 'EIO']) {
      it(`propagates ${code} from open instead of reporting the object as missing`, async () => {
        const driver = makeFilesystemStorage({ root, fs: failingFs(withCode(code)) });

        // Folding this into `null` would turn one storage outage into every
        // attachment and avatar answering 404 while the UI looked healthy.
        await expect(driver.open('anything.txt')).rejects.toThrow(code);
      });

      it(`propagates ${code} from delete`, async () => {
        const driver = makeFilesystemStorage({ root, fs: failingFs(withCode(code)) });

        await expect(driver.delete('anything.txt')).rejects.toThrow(code);
      });

      it(`propagates ${code} from put`, async () => {
        const driver = makeFilesystemStorage({ root, fs: failingFs(withCode(code)) });

        await expect(driver.put('anything.txt', Buffer.from('x'))).rejects.toThrow(code);
      });
    }

    it('classifies only the not-there codes as a missing object', () => {
      expect(isObjectMissingError(withCode('ENOENT'))).toBe(true);
      expect(isObjectMissingError(withCode('ENOTDIR'))).toBe(true);
      expect(isObjectMissingError(withCode('EACCES'))).toBe(false);
      expect(isObjectMissingError(withCode('ECONNREFUSED'))).toBe(false);
      expect(isObjectMissingError(new Error('no code at all'))).toBe(false);
    });
  });

  describe('key containment', () => {
    const unsafeKeys = [
      '../../../../src/index.ts',
      '../escape.png',
      'nested/child.txt',
      '..',
      '.',
      '',
    ];

    for (const key of unsafeKeys) {
      it(`refuses to write to ${JSON.stringify(key)}`, async () => {
        await expect(storage.put(key, Buffer.from('pwned'))).rejects.toThrow('Unsafe storage key');
      });
    }

    it('refuses to write to an absolute key, so no new absolute path can be created', async () => {
      const target = path.join(outside, 'planted.txt');

      await expect(storage.put(target, Buffer.from('pwned'))).rejects.toThrow('Unsafe storage key');
      expect(await fs.readdir(outside)).toEqual([]);
    });

    it('leaves nothing outside the root after a rejected write', async () => {
      for (const key of unsafeKeys) {
        await storage.put(key, Buffer.from('pwned')).catch(() => {});
      }

      expect(await fs.readdir(outside)).toEqual([]);
    });

    // The read side reports an unsafe key as "no such object" instead of throwing.
    // The public avatar route derives its key from the URL, so `/uploads/avatars/..`,
    // `/uploads/avatars/.` and a trailing-slash request all arrive here as one of
    // these; they answered 404 before this seam existed and must keep doing so
    // rather than becoming a trivially reachable 500.
    for (const key of ['../../../../etc/passwd', '..', '.', '', 'nested/child.txt']) {
      it(`reports ${JSON.stringify(key)} as missing on the read side`, async () => {
        expect(await storage.open(key)).toBeNull();
        expect(await storage.delete(key)).toBeUndefined();
      });
    }

    it('does not delete anything outside the root when handed a traversing key', async () => {
      const victim = path.join(outside, 'keep-me.txt');
      await fs.writeFile(victim, 'still here');

      await storage.delete(`../${path.basename(outside)}/keep-me.txt`);

      expect(await fs.readFile(victim, 'utf8')).toBe('still here');
    });
  });

  describe('legacy absolute paths', () => {
    // `attachments.file_path` holds absolute paths written before this seam
    // existed. They must stay readable byte for byte; `put` still refuses to make
    // any new one, so the affordance is bounded rather than growing.
    it('opens an absolute path recorded before the seam existed', async () => {
      const legacy = path.join(outside, 'stored-long-ago.txt');
      await fs.writeFile(legacy, 'legacy bytes');

      const handle = await storage.open(legacy);

      expect(await handle!.text()).toBe('legacy bytes');
    });

    it('reports a missing absolute path as null', async () => {
      expect(await storage.open(path.join(outside, 'gone.txt'))).toBeNull();
    });
  });
});

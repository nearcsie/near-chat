import nodeFs from 'fs/promises';
import path from 'path';
import { ATTACHMENTS_UPLOAD_DIR, AVATARS_UPLOAD_DIR } from './uploads';

/**
 * A stored object, opened for reading.
 *
 * Typed as `Blob` rather than a bare `ReadableStream` so that `new Response(handle)`
 * answers with a length instead of falling back to chunked transfer. `Bun.file()`
 * returns a `BunFile`, which is a `Blob`.
 *
 * A driver must return a handle whose `size` is an already-resolved number. That is
 * not free for every backend — `S3File extends Blob`, but its own type declaration
 * says the size "is a Promise because it requires a network request to determine"
 * it — so a driver over such a store has to resolve the size and adapt the handle
 * rather than hand the lazy object straight back. Stating it here keeps the one
 * guarantee this type exists for from being quietly lost in #687.
 */
export type StoredObject = Blob;

/**
 * The storage side effects the upload paths need, as an injectable seam.
 *
 * Services, routes and helpers take this instead of calling `Bun.write` / `Bun.file`
 * directly, following the same injection pattern as `AvatarStore`
 * (`utils/avatarUpload.ts`) — a trailing optional parameter defaulting to the real
 * implementation, so a unit test passes a stub without `mock.module()` polluting
 * Bun's process-global module registry (see issue #467 and `tests/CLAUDE.md`).
 *
 * Note that on the avatar path the two seams stack, and they are not the same
 * layer: `AvatarStore` stubs the *policy* (which avatar is saved or removed, and
 * the owner-prefix guard that decides whether a delete is allowed at all), while
 * this driver stubs the *bytes sink* underneath it.
 *
 * ## Error contract
 *
 * `open` returns `null` for exactly one reason: the object is not there. Every
 * other failure — a permission error, a connection reset, a bad credential — is
 * thrown, never folded into `null`.
 *
 * That distinction is load-bearing at the HTTP edge, where `null` becomes a 404
 * meaning "this file is gone" (`routes/attachmentRoutes.ts`, and the public avatar
 * route in `bootstrap/httpApp.ts`). A driver that swallowed its exceptions into
 * `null` would turn a single storage outage into every attachment and every avatar
 * answering 404 while the rest of the UI looked perfectly healthy: a total and
 * transient loss, reported to users as a great many individual permanent deletions.
 * Over a network-backed store that stops being hypothetical.
 *
 * `delete` is idempotent — removing an object that is already gone is a successful
 * no-op, not an error, which is also how an object store answers a DELETE of a
 * missing key. Every caller is a compensation path cleaning up after some earlier
 * failure, and throwing there would mask the failure being compensated for.
 * Permission and connection failures still throw.
 */
export interface StorageDriver {
  /** Writes `bytes` under `key`, replacing whatever was there. */
  put(key: string, bytes: Buffer): Promise<void>;
  /** Opens `key` for reading, or resolves `null` if no such object exists. */
  open(key: string): Promise<StoredObject | null>;
  /** Removes `key`. Resolves quietly when the object is already gone. */
  delete(key: string): Promise<void>;
}

/** The slice of `fs/promises` a filesystem driver needs, so a test can inject failures. */
export interface StorageFs {
  stat(target: string): Promise<{ isFile(): boolean }>;
  rm(target: string, options: { force: boolean }): Promise<void>;
  writeFile(target: string, bytes: Buffer): Promise<void>;
  mkdir(target: string, options: { recursive: boolean }): Promise<string | undefined>;
}

export interface FilesystemStorageOptions {
  /**
   * The directory every key of this driver lives in. An object-store driver reads
   * the same argument as its key prefix.
   */
  root: string;
  fs?: StorageFs;
}

/**
 * Maps a filesystem error to the `open` contract.
 *
 * Exported so the contract is unit-testable without manufacturing a real
 * permission failure. A `chmod 000` fixture would not do it: the test suite is
 * documented to run without Docker, and as root — which CI containers and most dev
 * boxes are — a mode-000 file is still readable, so such a test would pass for the
 * wrong reason and keep passing after the contract broke.
 */
export const isObjectMissingError = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
};

/**
 * Asserts that a key is a single safe path segment.
 *
 * This is the containment that used to sit inside `parseSingleFile`, moved to the
 * point where a name actually becomes a path. It matters more here than it did
 * there: the key is now composed one layer away from the write and there are two
 * writers, so this is the only check that still holds if a caller ever passes a
 * raw client-supplied filename. It is not filesystem-specific either — `../../x`
 * is a perfectly legal S3 key that quietly produces a garbage object.
 */
const isSafeSegment = (key: string): boolean =>
  Boolean(key) && key !== '.' && key !== '..' && !path.isAbsolute(key) && path.basename(key) === key;

const assertKeyIsSegment = (key: string): string => {
  if (!isSafeSegment(key)) {
    throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
  }
  return key;
};

/**
 * Resolves a key on the read and delete side, or `null` if it cannot name an
 * object in this store.
 *
 * Unsafe keys are reported as "no such object" here rather than thrown, which is
 * both true — `..` is not an object anyone stored — and behavior-preserving: the
 * public avatar route derives its key from the URL, so `/uploads/avatars/..`,
 * `/uploads/avatars/.` and a trailing-slash request all arrive as one of these.
 * Those answered 404 before this seam existed and must keep doing so instead of
 * becoming a trivially reachable 500. `put` still throws on the same keys, so
 * nothing can be written outside the root either way.
 *
 * Absolute keys are accepted because rows written before this seam existed hold a
 * full filesystem path (`/app/uploads/attachments/...`), and `attachmentRoutes`
 * resolved them with exactly this rule; reproducing it keeps those rows readable
 * byte for byte. The affordance is deliberately asymmetric — `put` rejects
 * absolute keys, so no new one can ever be created — which makes it bounded and
 * non-growing rather than a permanent hole. A non-filesystem driver must reject
 * absolute keys outright: #687 needs `attachments.file_path` normalized to bare
 * keys by a migration before an S3 driver can serve any pre-existing row. The
 * column's semantics are out of scope here, so nothing rewrites them.
 */
const resolveReadKey = (root: string, key: string): string | null => {
  if (path.isAbsolute(key)) {
    return key;
  }
  return isSafeSegment(key) ? path.join(root, key) : null;
};

/**
 * A `StorageDriver` backed by a directory on the local filesystem.
 *
 * This is the driver the upload paths have always effectively used; extracting it
 * changes no bytes on disk. #687 adds an S3-compatible sibling behind the same
 * interface.
 */
export const makeFilesystemStorage = ({
  root,
  fs = nodeFs,
}: FilesystemStorageOptions): StorageDriver => ({
  async put(key: string, bytes: Buffer): Promise<void> {
    const target = path.join(root, assertKeyIsSegment(key));

    // The driver creates its own root rather than depending on
    // `ensureUploadDirectories()` having run: a seam that silently fails because
    // some other module was supposed to prepare its storage is not much of a seam.
    // (`.gitkeep` sentinels stay that function's business — they are a filesystem
    // concern with no object-store analogue.)
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(target, bytes);
  },

  async open(key: string): Promise<StoredObject | null> {
    const target = resolveReadKey(root, key);
    if (target === null) {
      return null;
    }

    // `stat` rather than `Bun.file().exists()`, because `exists()` answers a flat
    // boolean and gives no way to tell "not there" from "could not look" — which
    // is precisely the distinction the error contract above turns on. This is the
    // one intentional behavior change in an otherwise behavior-preserving seam:
    // an unreadable file used to read as a 404 and now surfaces as a 500.
    let stats;
    try {
      stats = await fs.stat(target);
    } catch (error) {
      if (isObjectMissingError(error)) {
        return null;
      }
      throw error;
    }

    // A directory is not a readable object. Report it as missing, matching what
    // `Bun.file(dir).exists()` answered before, rather than handing back a handle
    // that fails on read.
    if (!stats.isFile()) {
      return null;
    }

    return Bun.file(target);
  },

  async delete(key: string): Promise<void> {
    const target = resolveReadKey(root, key);
    if (target === null) {
      return;
    }

    // `force` makes a missing object a no-op, as the contract requires, while a
    // real failure such as a read-only mount still throws.
    await fs.rm(target, { force: true });
  },
});

/** Storage for message attachments, rooted at the attachments upload directory. */
export const defaultAttachmentStorage: StorageDriver = makeFilesystemStorage({
  root: ATTACHMENTS_UPLOAD_DIR,
});

/** Storage for user and room avatars, rooted at the avatars upload directory. */
export const defaultAvatarStorage: StorageDriver = makeFilesystemStorage({
  root: AVATARS_UPLOAD_DIR,
});

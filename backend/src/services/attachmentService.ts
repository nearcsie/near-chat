import type { UploadedFile } from '../utils/fileUpload';
import type { StorageDriver } from '../utils/storageService';
import path from 'path';
import { ValidationError } from '../utils/AppError';
import { AttachmentRepository } from '../models/attachmentRepository';
import { makeStoredFileName } from '../utils/fileUpload';
import { logger } from '../utils/logger';
import { defaultAttachmentStorage } from '../utils/storageService';
import { ATTACHMENTS_UPLOAD_DIR } from '../utils/uploads';
import {
  COMPRESSIBLE_ATTACHMENT_FORMATS,
  COMPRESSIBLE_ATTACHMENT_MIME_TYPES,
  compressAttachmentBuffer,
  detectImageFormat,
  isAnimatedPng,
} from '../utils/imageCompression';

const containsEastAsianChars = (value: string) => /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(value);

const normalizeOriginalFilename = (filename: string) => {
  const decoded = Buffer.from(filename, 'latin1').toString('utf8');

  if (containsEastAsianChars(decoded) && !containsEastAsianChars(filename)) {
    return decoded;
  }

  return filename;
};

const WEBP_EXTENSION = '.webp';

// Mirrors `attachments.original_name VARCHAR(255)`. Swapping a shorter
// extension for `.webp` can push a previously-fitting name over the limit
// (251 chars + `.png` is exactly 255, but becomes 256 with `.webp`), which
// would fail the INSERT and orphan the already-converted file on disk.
const MAX_ORIGINAL_NAME_LENGTH = 255;

const withWebpExtension = (filename: string): string => {
  const base = filename.replace(/\.[^.\\/]+$/, '');
  const budget = MAX_ORIGINAL_NAME_LENGTH - WEBP_EXTENSION.length;

  // Count by code point so multi-byte names are measured the way Postgres
  // counts characters, and so truncation never splits a surrogate pair.
  const baseChars = Array.from(base);
  const safeBase = baseChars.length > budget ? baseChars.slice(0, budget).join('') : base;

  return `${safeBase}${WEBP_EXTENSION}`;
};

/** What the upload should store, once compression has had its say. */
interface StoredBytes {
  bytes: Buffer;
  fileType: string;
  originalName: string;
  /** Appended to the generated key, so a converted image still lands on `.webp`. */
  extension: string;
}

// Compresses eligible image attachments to WebP. Compression failures never
// fail the upload — the original bytes, mimetype and filename are kept.
//
// This decides *what* to store and writes nothing; the caller performs the one
// and only write. Previously the original was already on disk by the time this
// ran, so converting meant a second durable write plus a delete, and the "write
// the WebP to a new path first" dance existed so that a partial write (e.g.
// ENOSPC) could never leave a truncated file under the path we go on to record.
//
// Ordering now supplies that guarantee for free, and for every attachment rather
// than only the converted ones: the single write happens before the row that
// points at it, so a failed write throws before any record can reference the
// incomplete object. What remains is an unreferenced object, which is the same
// invisible residue a failed conversion already left behind.
const chooseStoredBytes = async (
  file: UploadedFile,
  originalName: string,
): Promise<StoredBytes> => {
  const unchanged = {
    bytes: file.buffer,
    fileType: file.mimetype,
    originalName,
    extension: '',
  };

  if (!file.buffer || !COMPRESSIBLE_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
    return unchanged;
  }

  let detectedFormat: string | undefined;
  try {
    detectedFormat = await detectImageFormat(file.buffer);
  } catch {
    return unchanged;
  }

  // The multipart MIME and extension are controlled by the client. Only let
  // bytes that are actually a still-image-capable JPEG/PNG enter this
  // single-frame conversion path; animated GIF/WebP data disguised as PNG
  // must remain byte-for-byte untouched.
  if (!detectedFormat || !COMPRESSIBLE_ATTACHMENT_FORMATS.has(detectedFormat)) {
    return unchanged;
  }

  // `image/png` also covers APNG. Re-encoding one here would keep only the
  // first frame and permanently drop the animation, which is exactly what
  // excluding GIF above is meant to avoid — so skip those too.
  if (detectedFormat === 'png' && (await isAnimatedPng(file.buffer))) {
    return unchanged;
  }

  try {
    const compressed = await compressAttachmentBuffer(file.buffer);

    // Keep an already well-optimized source image when WebP would be larger.
    if (compressed.length >= file.buffer.length) {
      return unchanged;
    }

    // The bytes are WebP now, so the stored download filename must say so —
    // it is handed straight to the browser as the saved file's name.
    return {
      bytes: compressed,
      fileType: 'image/webp',
      originalName: withWebpExtension(originalName),
      extension: WEBP_EXTENSION,
    };
  } catch {
    return unchanged;
  }
};

/**
 * Builds the storage key for one upload.
 *
 * `parseSingleFile` has already produced the safe, unique stem; all this adds is
 * whatever extension the conversion settled on, so a converted image still lands on
 * `<stem>.webp` exactly as it did when the WebP was written beside the original.
 * Keeping that shape keeps the recorded path inside the length budget of
 * `attachments.file_path VARCHAR(255)` and leaves the column's semantics alone.
 */
const buildStorageKey = (file: UploadedFile, extension: string): string =>
  `${file.filename || makeStoredFileName(file.originalname || 'upload')}${extension}`;

export function makeAttachmentService(
  attachmentRepo: AttachmentRepository,
  storage: StorageDriver = defaultAttachmentStorage,
) {
  return {
    async uploadAttachment(uploadedBy: string, file: UploadedFile) {
      if (!uploadedBy) {
        throw new ValidationError('uploadedBy is required');
      }
      if (!file) {
        throw new ValidationError('file is required');
      }

      const { bytes, fileType, originalName, extension } = await chooseStoredBytes(
        file,
        normalizeOriginalFilename(file.originalname),
      );
      const key = buildStorageKey(file, extension);

      // The object is written before the row that points at it, which is what
      // makes a single write safe: if this throws (ENOSPC, a storage outage), no
      // record ever referenced the incomplete object, and the residue is the same
      // unreferenced garbage a failed conversion already left behind.
      await storage.put(key, bytes);

      // `attachments.file_path` holds an absolute filesystem path today. That is
      // this column's existing semantics, which #687 owns changing; the read side
      // resolves such a value through the same driver.
      const filePath = path.join(ATTACHMENTS_UPLOAD_DIR, key);

      try {
        return await attachmentRepo.create({
          uploadedBy,
          filePath,
          fileType,
          originalName,
        });
      } catch (error) {
        // Compensate, mirroring `userService.uploadAvatar`. The cleanup must never
        // replace the error that caused it: a failure to delete is logged and
        // swallowed so the original `create` failure is what reaches the caller.
        await storage
          .delete(key)
          .catch((err) => logger.error({ err, key }, 'Failed to remove orphaned attachment object'));
        throw error;
      }
    },
    async getAttachment(userId: string, attachmentId: string) {
      const attachment = await attachmentRepo.findByIdForUser(attachmentId, userId);
      const isRecalled = attachment?.messageIsRecalled;
      if (!attachment || isRecalled === true) {
        return null;
      }
      return attachment;
    }
  };
}

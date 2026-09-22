import type { Context } from 'hono';
import path from 'path';
import { ValidationError } from '../utils/AppError';

export interface UploadedFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  /** The name the bytes should be stored under, already made safe and unique. */
  filename?: string;
  stream?: ReadableStream | null;
}

/** Sanitizes client-provided filename into a safe path segment without path traversal. */
export const sanitizeStoredFileName = (rawName: string): string => {
  const segment = path.posix.basename(String(rawName ?? '').replace(/\\/g, '/'));
  const safe = segment
    .replace(/\0/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+/, '');
  return safe.length > 0 ? safe.slice(-100) : 'upload';
};

/**
 * Builds the name an upload is stored under.
 *
 * Kept here, beside `sanitizeStoredFileName`, rather than moved next to the write:
 * the two properties this name carries — it never contains a path separator, and
 * two uploads of one filename never collide — are properties of the name itself,
 * and they stay directly unit-testable as long as the generator does too. The
 * timestamp and random segment supply the uniqueness; `sanitizeStoredFileName`
 * supplies the safety.
 */
export const makeStoredFileName = (originalName: string): string =>
  `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${sanitizeStoredFileName(originalName)}`;

// Allowance for multipart envelope headers and boundaries.
const MULTIPART_OVERHEAD_ALLOWANCE = 64 * 1024;

/** Enforces byte limit on incoming request stream to avoid buffering oversized bodies. */
const limitBodyStream = (
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> => {
  const reader = body.getReader();
  let received = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();

      if (done) {
        controller.close();
        return;
      }

      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel('upload exceeded its size limit');
        controller.error(new ValidationError('File size limit exceeded'));
        return;
      }

      controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
};

/** Decodes multipart form body using byte-limited stream. */
const parseFormBody = async (c: Context, maxBytes?: number): Promise<FormData> => {
  const raw = c.req.raw;
  const contentType = raw.headers.get('content-type') ?? '';
  const body = raw.body;

  if (!body) {
    throw new ValidationError('file is required');
  }

  const stream = maxBytes ? limitBodyStream(body, maxBytes + MULTIPART_OVERHEAD_ALLOWANCE) : body;

  try {
    return await new Response(stream, { headers: { 'content-type': contentType } }).formData();
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('file is required');
  }
};

export interface ParseFileOptions {
  fieldName?: string;
  maxBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  restrictionEnabled?: boolean;
}

export async function parseSingleFile(
  c: Context,
  options: ParseFileOptions = {}
): Promise<UploadedFile> {
  const fieldName = options.fieldName ?? 'file';

  // Fast-path rejection if declared Content-Length already exceeds limit.
  if (options.maxBytes) {
    const declaredLength = Number(c.req.header('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes + MULTIPART_OVERHEAD_ALLOWANCE) {
      throw new ValidationError('File size limit exceeded');
    }
  }

  const body = await parseFormBody(c, options.maxBytes);
  const file = body.get(fieldName);

  if (!file || typeof file === 'string') {
    throw new ValidationError('file is required');
  }

  const fileObj = file as File;
  const rawMime = (fileObj.type || 'application/octet-stream').toLowerCase();
  const cleanMime = rawMime.split(';')[0].trim();

  if (options.maxBytes && fileObj.size > options.maxBytes) {
    throw new ValidationError('File size limit exceeded');
  }

  if (options.restrictionEnabled) {
    if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0 && !options.allowedMimeTypes.includes(cleanMime)) {
      throw new ValidationError(`Attachment MIME type is not allowed: ${fileObj.type}`);
    }

    const extension = fileObj.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (
      options.allowedExtensions &&
      options.allowedExtensions.length > 0 &&
      (!extension || !options.allowedExtensions.includes(extension))
    ) {
      throw new ValidationError(`Attachment file extension is not allowed: ${extension ?? 'unknown'}`);
    }
  } else if (options.restrictionEnabled === undefined && options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
    if (!options.allowedMimeTypes.includes(cleanMime)) {
      throw new ValidationError('Unsupported file type');
    }
  }

  const arrayBuffer = await fileObj.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Parsing only: this returns the bytes and a safe name, and writes nothing.
  //
  // It used to stage the upload on disk itself, which forced a second durable
  // write whenever the service went on to store different bytes than it was
  // handed — every compressible image cost a write, a write and a delete. Deciding
  // the final bytes is the service's call, so the single write that follows from
  // it belongs there too (see `services/attachmentService.ts`).
  return {
    fieldname: fieldName,
    originalname: fileObj.name,
    encoding: '7bit',
    mimetype: cleanMime,
    buffer,
    size: fileObj.size,
    filename: makeStoredFileName(fileObj.name),
    stream: null,
  };
}

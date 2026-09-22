import { describe, it, expect, spyOn } from 'bun:test';

import { mapErrorToApiShape } from '../../../src/utils/mapError';
import { AppError, ValidationError, ForbiddenError, NotFoundError, ConflictError, IdempotencyConflictError } from '../../../src/utils/AppError';
import { logger } from '../../../src/utils/logger';

describe('mapErrorToApiShape', () => {
  it('maps ValidationError (400)', () => {
    const err = new ValidationError('bad request');
    expect(mapErrorToApiShape(err)).toEqual({
      statusCode: 400,
      message: 'bad request',
      code: 'VALIDATION_ERROR',
    });
  });

  it('maps AppError directly (e.g. 401)', () => {
    const err = new AppError(401, 'unauth', 'UNAUTHORIZED');
    expect(mapErrorToApiShape(err)).toEqual({
      statusCode: 401,
      message: 'unauth',
      code: 'UNAUTHORIZED',
    });
  });

  it('maps ForbiddenError (403)', () => {
    const err = new ForbiddenError('forbidden');
    expect(mapErrorToApiShape(err)).toEqual({
      statusCode: 403,
      message: 'forbidden',
      code: 'FORBIDDEN',
    });
  });

  it('maps NotFoundError (404)', () => {
    const err = new NotFoundError('User', '123');
    expect(mapErrorToApiShape(err)).toEqual({
      statusCode: 404,
      message: 'User with id 123 not found',
      code: 'NOT_FOUND',
    });
  });

  it('maps ConflictError (409)', () => {
    const err = new ConflictError('conflict');
    expect(mapErrorToApiShape(err)).toEqual({
      statusCode: 409,
      message: 'conflict',
      code: 'CONFLICT',
    });
  });

  it('maps IdempotencyConflictError (409) to its own code', () => {
    const err = new IdempotencyConflictError('Idempotency-Key was already used for another operation');
    expect(mapErrorToApiShape(err)).toEqual({
      statusCode: 409,
      message: 'Idempotency-Key was already used for another operation',
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });

  it('gives the two 409 families different codes, so a client can tell retryable from permanent', () => {
    const stale = mapErrorToApiShape(new ConflictError('Message revision is stale'));
    const consumedKey = mapErrorToApiShape(new IdempotencyConflictError('Idempotency-Key was already used for another message'));

    expect(stale.statusCode).toBe(consumedKey.statusCode);
    expect(stale.code).not.toBe(consumedKey.code!);
  });

  it('maps unknown errors to 500', () => {
    const err = new Error('database connection failed');
    expect(mapErrorToApiShape(err)).toEqual({
      statusCode: 500,
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  });

  it('reports unknown errors through the logger', () => {
    const errorSpy = spyOn(logger, 'error').mockImplementation(() => {});
    try {
      const err = new Error('unexpected');
      expect(mapErrorToApiShape(err).statusCode).toBe(500);
      expect(errorSpy).toHaveBeenCalledWith({ err }, 'APP ERROR');
    } finally {
      errorSpy.mockRestore();
    }
  });

  // The oversized-upload path is `ValidationError('File size limit exceeded')`
  // from `parseSingleFile`, which maps through the `AppError` branch above.
  // `multer` is no longer a dependency, so nothing constructs a `MulterError`.
  it('maps an unrecognized upload error object to 500 rather than a guessed status', () => {
    const errorSpy = spyOn(logger, 'error').mockImplementation(() => {});
    try {
      const err = { name: 'MulterError', code: 'LIMIT_FILE_SIZE', message: 'File too large' } as unknown;

      expect(mapErrorToApiShape(err)).toEqual({
        statusCode: 500,
        message: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
      });
    } finally {
      errorSpy.mockRestore();
    }
  });
});

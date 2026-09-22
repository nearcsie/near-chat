export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(404, `${resource} with id ${id} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * A command that collided with a durable Idempotency-Key receipt. Separate from
 * `ConflictError` because the two carry opposite retry advice on the same 409:
 * a stale revision is retryable once the client refetches, whereas a consumed
 * key never becomes usable again, so a client outbox must stop retrying it.
 */
export class IdempotencyConflictError extends ConflictError {
  constructor(message: string) {
    super(message);
    this.code = 'IDEMPOTENCY_CONFLICT';
    this.name = 'IdempotencyConflictError';
  }
}

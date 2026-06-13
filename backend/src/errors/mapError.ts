import { AppError } from './AppError';
import type { ApiError } from '@shared/types';

export const mapErrorToApiShape = (err: unknown): ApiError => {
  if (err instanceof AppError) {
    const apiError: ApiError = {
      statusCode: err.statusCode,
      message: err.message,
    };
    if (err.code !== undefined) {
      apiError.code = err.code;
    }
    return apiError;
  }

  // Unknown / unexpected errors
  if (process.env.NODE_ENV !== 'test') {
    console.error("APP ERROR:", err);
  }
  return {
    statusCode: 500,
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  };
};

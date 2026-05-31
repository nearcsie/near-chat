import rateLimit, { type Options } from 'express-rate-limit';
import helmet from 'helmet';

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const rateLimitDisabled = (): boolean =>
  process.env.NODE_ENV === 'test' || process.env.RATE_LIMIT_DISABLED === 'true';

export const securityHeaders = helmet();

export const makeGlobalRateLimiter = (overrides: Partial<Options> = {}) =>
  rateLimit({
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    limit: parsePositiveInt(process.env.RATE_LIMIT_MAX, 100),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => rateLimitDisabled(),
    message: { message: 'Too many requests, please try again later' },
    ...overrides,
  });

export const makeAuthRateLimiter = (overrides: Partial<Options> = {}) =>
  rateLimit({
    windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    limit: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 10),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: () => rateLimitDisabled(),
    message: { message: 'Too many authentication attempts, please try again later' },
    ...overrides,
  });

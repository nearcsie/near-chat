# Security Middleware Notes

This records the implemented backend contract for issues #78 and #79.

- `helmet()` is mounted globally before API routes, so REST responses include standard security headers such as CSP, `X-Frame-Options`, and `X-Content-Type-Options`.
- A global `express-rate-limit` baseline is mounted on `/api` with default `100` requests per `15` minutes.
- A stricter auth limiter is mounted on `/api/v1/auth` with default `10` attempts per `15` minutes and `skipSuccessfulRequests=true`, so successful normal auth flows are not counted as brute-force attempts.
- Limits can be tuned with `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`, and `AUTH_RATE_LIMIT_MAX`.
- Rate limit counters are skipped in `NODE_ENV=test` or when `RATE_LIMIT_DISABLED=true`, while unit tests cover the enabled limiter behavior directly. This prevents existing localhost-heavy e2e suites from failing due to unrelated request volume.

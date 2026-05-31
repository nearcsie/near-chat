# Auth Cookie Notes

This records the implemented backend contract for issues #80 and #81.

- `POST /api/v1/auth/register` and `POST /api/v1/auth/login` still return the JWT in the JSON response for backward compatibility, and also set `auth_token` as an `HttpOnly; Secure; SameSite=Strict` cookie.
- `POST /api/v1/auth/logout` clears the `auth_token` cookie.
- `authMiddleware` reads `auth_token` first and falls back to `Authorization: Bearer <token>` while the frontend migration is in progress.
- The per-request soft-delete database query was removed from `authMiddleware`. Soft-deleted users are blocked at login/search, and JWTs are short-lived by default.
- `JWT_EXPIRES_IN` controls token lifetime and defaults to `15m`; `AUTH_COOKIE_MAX_AGE_MS` controls cookie max age and defaults to 15 minutes.
- Frontend API requests use `credentials: 'include'`, and backend CORS is configured with credentials support.

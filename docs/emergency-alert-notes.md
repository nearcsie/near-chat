# Emergency Alert Notes

This records the implemented backend contract for issues #50 and #56.

- `POST /api/v1/users/me/emergency-alert` triggers an immediate emergency alert for the authenticated user only.
- `POST /api/v1/users/me/emergency-alert/check-inactivity` checks the authenticated user's `warningEnabled`, `warningDays`, and `lastActivity` values. It accepts optional `{ "now": "ISO datetime" }` for tests or local/manual runs.
- Emergency alerts emit Socket.IO `emergency_alert` to each configured emergency contact's `user_<contactId>` channel with `{ userId, message }`.
- Inactivity alerts are deduplicated by `(userId, lastActivity)` in `emergency_alert_logs`, so the same stale activity state is not notified repeatedly.
- `lastActivity` is refreshed on successful login. A deployment can run the inactivity check endpoint from an authenticated local job or replace it with a server-side scheduler later.

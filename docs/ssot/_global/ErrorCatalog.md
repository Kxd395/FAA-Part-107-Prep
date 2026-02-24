# Error Catalog

## Error UI standards
- Inline field errors: Not broadly implemented (few form fields).
- Toast: Not implemented.
- Modal: Used for reference viewer, not for error alerts.
- Full page/panel: Used for question-bank load failures and empty states.

## Error codes
| Code | Meaning | User message | Retry? | Logging | Notes |
|------|---------|--------------|--------|---------|------|
| `QUESTION_BANK_FETCH_FAILED` | Client fetch to `/api/questions` returned non-2xx | "Couldn't load questions" + raw error message | Yes (`Retry` button) | Local only | Implemented in study/exam/learn/flashcards/missed loading guards |
| `QUESTION_BANK_SNAPSHOT_FALLBACK` | Live question source failed after retries but cached snapshot exists | Warning banner: "Using cached question snapshot..." with age badge and recovery controls (`Try Live Source`, `Clear Cached Snapshot`) | Yes (manual reload retries live source) | Local only | Triggered by `useQuestionBank` retry/backoff + snapshot fallback path |
| `API_QUESTIONS_INTERNAL_ERROR` | `/api/questions` threw during load/filter/sanitize | JSON `{ "error": "..." }` with HTTP 500 | Caller-dependent | Server log UNKNOWN | Includes remote source failures and malformed remote payload |
| `API_QUESTIONS_RATE_LIMITED` | `/api/questions` exceeded per-IP request window | JSON `{ "error": "Too many question requests" }` with HTTP 429 | Yes (after `Retry-After`) | Server route response | In-memory limiter, 180 req/min |
| `INVALID_CATEGORY_PARAM` | Query `category` does not normalize | Setup warning, fallback to full exam/default | N/A | None | Explicit warning in exam setup |
| `INVALID_QUESTION_TYPE_PARAM` | Query `type` invalid or unsupported | Setup warning, fallback to default type | N/A | None | Explicit warning in study/exam setup |
| `EMPTY_SELECTION` | Selected filters yield zero questions | "No questions available..." or disabled start button | Adjust filters | None | Behavior varies by page/phase |
| `REFERENCE_EMBED_UNAVAILABLE` | Citation/URL cannot be embedded in modal | "Open in a new browser tab" | Yes | None | Handled in `ReferenceModal` |
| `IMAGE_LOAD_FAILED` | Figure image fails in question/card/modal | Fallback to text/placeholder | N/A | None | Some paths show fallback text only |
| `LOCALSTORAGE_PARSE_FAILED` | Stored JSON corrupt or invalid shape | Silent fallback to empty state/data reset | Indirect | None | Current behavior masks errors; no user-facing recovery path |
| `LEARN_DRAFT_INVALID` | Saved learn session references missing question IDs | Draft is discarded and resume is unavailable | Yes (start new session) | None | Triggered during learn resume validation |
| `PROGRESS_IMPORT_INVALID` | Imported progress snapshot is malformed/unsupported | Import failed banner with parse/format message | Yes (retry with valid export) | None | Progress page import flow |
| `ANALYTICS_EVENT_INVALID` | Learning event does not match taxonomy or metadata schema | Event dropped silently for user; dev warning logged | N/A | Browser console warning | Enforced by `validateLearningEventInput` before append/sink send |
| `ANALYTICS_SINK_DEAD_LETTERED` | Sink forwarding failed after retries and event was queued to dead-letter store | No user-facing error (local telemetry still succeeds) | Automatic retry on next event | Local dead-letter queue (`part107_analytics_sink_deadletter_v1`) | Best-effort sink design; does not block local writes |
| `SYNC_SESSION_INVALID` | `/api/sync/session` called without required `userId` in signed mode | JSON `{ error: "userId is required" }` with `400` | Yes | Server route response | Only applies when `SYNC_SIGNING_SECRET` is configured |
| `SYNC_UPLOAD_REJECTED` | `/api/sync/upload` request failed auth/validation/user-match checks | JSON `{ error }` with `400/401/403` | Yes | Server route response | Auth required via signed bearer token (signed mode) or `x-sync-user-id` header (fallback mode) |
| `SYNC_SNAPSHOT_SIGNATURE_INVALID` | `/api/sync/upload` received invalid `snapshot.signature` | JSON `{ error: "snapshot signature is invalid" }` with `400` | Yes | Server route response | Enforced when `SYNC_SNAPSHOT_HMAC_SECRET` is configured and signature was provided |
| `SYNC_DOWNLOAD_NOT_FOUND` | `/api/sync/download` has no stored snapshot for user | JSON `{ snapshot: null }` + `404` | Yes (retry after upload) | Server route response | Not a hard error for first-time sync users |
| `SYNC_RATE_LIMITED` | `/api/sync/upload` or `/api/sync/download` exceeded per-IP request window | JSON `{ error }` with HTTP 429 | Yes (after `Retry-After`) | Server route response | Upload: 60 req/min, Download: 120 req/min |
| `SYNC_SESSION_RATE_LIMITED` | `/api/sync/session` exceeded per-IP request window | JSON `{ error }` with HTTP 429 | Yes (after `Retry-After`) | Server route response | Session bootstrap: 30 req/min |
| `INTERNAL_METRICS_UNAUTHORIZED` | `/api/_internal/rate-limit-metrics` called without valid bearer token when token is configured | JSON `{ error: "Unauthorized" }` with `401` | Yes (with correct token) | Server route response | Controlled by `INTERNAL_METRICS_TOKEN` |
| `AUTH_SESSION_INVALID_USER` | `/api/auth/session` login request has invalid `userId` format | JSON `{ error }` with `400` | Yes (with valid user id) | Server route response | User IDs must match `[a-zA-Z0-9._-]{3,64}` |
| `AUTH_SESSION_PROD_DISABLED` | `/api/auth/session` direct login called in production mode | JSON `{ error }` with `403` | Yes (use magic-link flow) | Server route response | Dev-only direct sign-in backdoor |
| `AUTH_SESSION_RATE_LIMITED` | `/api/auth/session` login exceeded per-IP request window | JSON `{ error }` with HTTP `429` | Yes (after `Retry-After`) | Server route response | 30 req/min |
| `AUTH_MAGIC_LINK_INVALID_EMAIL` | `/api/auth/magic-link` called with invalid email | JSON `{ error }` with `400` | Yes | Server route response | Email is normalized/lowercased |
| `AUTH_MAGIC_LINK_SEND_FAILED` | Magic-link provider failed to send email | JSON `{ error }` with `500` | Yes | Server route + provider response | Dev mode logs URL to console instead of email delivery |
| `AUTH_VERIFY_INVALID_TOKEN` | `/api/auth/verify` token missing/invalid/expired | JSON `{ error }` with `400/401` | Yes (request new link) | Server route response | 15-minute token TTL |
| `USER_STATE_UNAUTHORIZED` | `/api/user/state` called without valid auth cookie | JSON `{ error: "Unauthorized" }` with `401` | Yes (after login) | Server route response | Requires signed `part107_auth` cookie |
| `USER_STATE_INVALID_PAYLOAD` | `/api/user/state` put payload missing valid `mode` or object `data` | JSON `{ error }` with `400` | Yes | Server route response | `mode` must be `merge|overwrite` |
| `USER_STATE_RATE_LIMITED` | `/api/user/state` exceeded per-IP request window | JSON `{ error }` with HTTP `429` | Yes (after `Retry-After`) | Server route response | GET 120 req/min, PUT 60 req/min |
| `USER_PROFILE_UNAUTHORIZED` | `/api/user/profile` called without valid auth cookie | JSON `{ error: "Unauthorized" }` with `401` | Yes (after login) | Server route response | Requires signed `part107_auth` cookie |
| `USER_PROFILE_NOT_FOUND` | `/api/user/profile` record missing for authenticated user | JSON `{ error: "Profile not found" }` with `404` | Yes | Server route response | Possible when cookie points to unknown user id |
| `USER_PROFILE_RATE_LIMITED` | `/api/user/profile` exceeded per-IP request window | JSON `{ error }` with HTTP `429` | Yes (after `Retry-After`) | Server route response | GET 120 req/min, PATCH 30 req/min |

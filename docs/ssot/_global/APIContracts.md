# API Contracts

Rules:
- No invented endpoints. If unknown, mark UNKNOWN.

## Endpoint: Get Questions
- Method: `GET`
- Path: `/api/questions`
- Auth: None
- Request query params:
  - `category` (optional string; normalized to supported categories; default `All`)
  - `shuffle` (optional boolean-like string; truthy for `1` or `true`)
  - `limit` (optional integer; min 1, max 500)
- Request headers: None required
- Response (`200`) shape:
  - `questions: Question[]`
  - `meta.total: number`
  - `meta.category: string`
  - `meta.shuffled: boolean`
  - `meta.limit: number | null`
  - `meta.source: "remote" | "local"`
- Runtime contract enforcement:
  - Client parser (`parseQuestionApiResponse`) validates `questions[]` and `meta` before accepting payloads.
  - Invalid response shape throws and enters retry/fallback path.
- Data source behavior:
  - Uses `QUESTION_SOURCE_URL` env var when present (server fetch with `cache: no-store`)
  - Falls back to bundled JSON files when env var absent
- Pagination rules:
  - No cursor/page support
  - Optional hard cut via `limit`
- Rate limits:
  - In-memory per-IP limiter: `180` requests/minute
  - `429` on limit exceeded with `Retry-After`
- Caching:
  - Route exports `dynamic = "force-dynamic"`, `revalidate = 0`
  - Response header `Cache-Control: no-store, max-age=0`
- Error codes:
  - `429` with body `{ error: "Too many question requests" }`
  - `500` with body `{ error: string }` on any thrown error
- Idempotency requirements:
  - Safe and idempotent read endpoint

## Endpoint: Remote Question Source (indirect dependency)
- Method: `GET`
- Path: `QUESTION_SOURCE_URL` (environment configured)
- Auth: UNKNOWN
- Expected response shape:
  - Either `Question[]`
  - Or `{ questions: Question[] }`
- Runtime contract enforcement:
  - Server parser (`parseRemoteQuestionSourcePayload`) validates remote payload shape and question entries before sanitization/normalization.
- Errors:
  - Non-2xx raises server error in `/api/questions`
  - Invalid payload shape raises server error in `/api/questions`
- Contract owner:
  - UNKNOWN (external integration)

## Endpoint: Sync Upload
- Method: `POST`
- Path: `/api/sync/upload`
- Auth:
  - Mode A (`SYNC_SIGNING_SECRET` configured): required bearer signed sync session token from `/api/sync/session`
  - Mode B (`SYNC_SIGNING_SECRET` unset): required header `x-sync-user-id`, optional static bearer token when `SYNC_API_TOKEN` is configured
- Request body:
  - `userId: string` (must match authenticated sync user)
  - `mode: "merge" | "overwrite"`
  - `snapshot: { version: 1; exportedAt: string; data: Record<string, string | null>; signature?: string }`
- Response (`200`) shape:
  - `accepted: boolean`
  - `mergedSummary.changedKeys: string[]`
  - `mergedSummary.conflicts: number`
  - `updatedAt: string`
- Signature behavior:
  - If request includes `snapshot.signature` and `SYNC_SNAPSHOT_HMAC_SECRET` is configured, signature must validate or request is rejected (`400`).
  - Server signs persisted snapshots when `SYNC_SNAPSHOT_HMAC_SECRET` is configured.
- Merge behavior:
  - Reuses progress/adaptive/telemetry merge engine from `progressImportMerge`.
  - Supported keys: `part107_progress`, `part107_adaptive_stats_v2`, `part107_attempt_events_v1`, `part107_learning_events_v1`, `part107_flashcard_sr`, `part107_learn_draft_v1`.
- Error codes:
  - `429` rate limit exceeded
  - `401` missing/invalid sync auth token/header
  - `403` payload `userId` mismatch
  - `400` invalid `mode`, invalid snapshot envelope, or invalid snapshot signature
  - `500` unexpected server failure
- Idempotency requirements:
  - Semantically idempotent when posting identical payload and mode.
- Rate limits:
  - In-memory per-IP limiter: `60` requests/minute

## Endpoint: Sync Download
- Method: `GET`
- Path: `/api/sync/download`
- Auth:
  - Mode A (`SYNC_SIGNING_SECRET` configured): required bearer signed sync session token from `/api/sync/session`
  - Mode B (`SYNC_SIGNING_SECRET` unset): required header `x-sync-user-id`, optional static bearer token when `SYNC_API_TOKEN` is configured
- Request query params:
  - `userId` (optional; defaults to authenticated sync user; cross-user reads rejected)
- Response (`200`) shape:
  - `userId: string`
  - `snapshot: { version: 1; exportedAt: string; data: Record<string, string | null>; signature?: string }`
  - `updatedAt: string`
- Response (`404`) shape:
  - `userId: string`
  - `snapshot: null`
  - `updatedAt: null`
- Error codes:
  - `429` rate limit exceeded
  - `401` missing/invalid sync auth
  - `403` requested `userId` mismatch with authenticated user
- Caching:
  - Route exports `dynamic = "force-dynamic"`, `revalidate = 0`
  - Response header `Cache-Control: no-store, max-age=0` for successful snapshot reads
- Rate limits:
  - In-memory per-IP limiter: `120` requests/minute

## Endpoint: Sync Session
- Method: `POST`
- Path: `/api/sync/session`
- Auth:
  - No user auth; rate-limited session bootstrap endpoint
- Request body:
  - In signed mode (`SYNC_SIGNING_SECRET` set): `{ userId: string }` required
  - In header mode (`SYNC_SIGNING_SECRET` unset): body ignored
- Response (`200`) shape:
  - Signed mode:
    - `token: string`
    - `mode: "signed-token"`
    - `expiresInSeconds: 3600`
  - Header mode:
    - `token: null`
    - `mode: "header-user-id"`
- Error codes:
  - `400` missing `userId` in signed mode
  - `429` rate limit exceeded
- Rate limits:
  - In-memory per-IP limiter: `30` requests/minute

## Endpoint: Internal Rate-Limit Metrics
- Method: `GET`
- Path: `/api/_internal/rate-limit-metrics`
- Auth:
  - If `INTERNAL_METRICS_TOKEN` is configured, requires `Authorization: Bearer <token>`
  - If `INTERNAL_METRICS_TOKEN` is unset, endpoint is ungated (debug-only)
- Response (`200`) shape:
  - `generatedAt: string`
  - `metrics: Record<string, { allowed: number; blocked: number }>`
- Error codes:
  - `401` missing/invalid metrics bearer token (when token is configured)
- Notes:
  - Exposes in-memory counters for configured limiter keys (for example `api:questions`, `api:sync:upload`, `api:sync:download`, `api:sync:session`).

## Endpoint: App Auth Session
- Method: `GET`
- Path: `/api/auth/session`
- Auth:
  - Optional cookie-based auth (`part107_auth`) using signed token
- Response (`200`) shape:
  - `authenticated: boolean`
  - `userId: string | null`
  - `email: string | null`
  - `displayName: string | null`

## Endpoint: App Auth Login
- Method: `POST`
- Path: `/api/auth/session`
- Auth:
  - Public; establishes signed session cookie
- Request body:
  - `userId: string` (3-64 chars, `[a-zA-Z0-9._-]`)
- Response (`200`) shape:
  - `authenticated: true`
  - `userId: string`
  - `expiresInSeconds: number`
- Cookie behavior:
  - Sets `part107_auth` (`httpOnly`, `sameSite=lax`, `path=/`, `maxAge=7d`)
- Error codes:
  - `400` invalid `userId`
  - `403` disabled in production (magic-link flow required)
  - `429` rate limit exceeded
- Rate limits:
  - In-memory per-IP limiter: `30` requests/minute

## Endpoint: App Auth Logout
- Method: `DELETE`
- Path: `/api/auth/session`
- Auth:
  - Optional active cookie
- Response (`200`) shape:
  - `authenticated: false`
  - `userId: null`
- Cookie behavior:
  - Clears `part107_auth`

## Endpoint: Magic Link Request
- Method: `POST`
- Path: `/api/auth/magic-link`
- Auth:
  - Public
- Request body:
  - `email: string` (RFC-style email validation)
- Response (`200`) shape:
  - `sent: true`
  - `devUrl?: string` (non-production only, returned when email provider is not configured)
- Error codes:
  - `400` invalid email
  - `429` rate limit exceeded
  - `500` mail send failure
- Rate limits:
  - In-memory per-IP limiter: `30` requests/minute

## Endpoint: Magic Link Verify
- Method: `POST`
- Path: `/api/auth/verify`
- Auth:
  - Public (token-based)
- Request body:
  - `token: string`
- Response (`200`) shape:
  - `authenticated: true`
  - `userId: string`
  - `email: string`
  - `displayName: string`
  - `expiresInSeconds: number`
- Cookie behavior:
  - Sets `part107_auth` (`httpOnly`, `sameSite=lax`, `path=/`, `maxAge=7d`)
- Error codes:
  - `400` missing token
  - `401` invalid/expired magic link
  - `429` rate limit exceeded

## Endpoint: Google Auth Sign-In
- Method: `POST`
- Path: `/api/auth/google`
- Auth:
  - Public (Google ID token-based)
- Request body:
  - `credential: string` (Google identity credential token)
- Response (`200`) shape:
  - `authenticated: true`
  - `userId: string`
  - `email: string`
  - `displayName: string`
  - `expiresInSeconds: number`
- Cookie behavior:
  - Sets `part107_auth` (`httpOnly`, `sameSite=lax`, `path=/`, `maxAge=7d`)
- Server requirements:
  - `GOOGLE_CLIENT_ID` must be configured
  - Token is verified with Google SDK against configured audience
- Error codes:
  - `400` missing credential
  - `401` invalid/unverified Google token
  - `429` rate limit exceeded
  - `501` Google auth not configured

## Endpoint: User Profile Get
- Method: `GET`
- Path: `/api/user/profile`
- Auth:
  - Required `part107_auth` signed cookie
- Response (`200`) shape:
  - `userId: string`
  - `email: string`
  - `displayName: string`
  - `avatarUrl: string | null`
  - `createdAt: string`
  - `updatedAt: string`
- Response (`404`) shape:
  - `userId: string`
  - `profile: null`
- Error codes:
  - `401` unauthorized
  - `429` rate limit exceeded

## Endpoint: User Profile Update
- Method: `PATCH`
- Path: `/api/user/profile`
- Auth:
  - Required `part107_auth` signed cookie
- Request body:
  - `displayName?: string`
  - `avatarUrl?: string | null`
- Response (`200`) shape:
  - `userId: string`
  - `email: string`
  - `displayName: string`
  - `avatarUrl: string | null`
  - `createdAt: string`
  - `updatedAt: string`
- Error codes:
  - `401` unauthorized
  - `404` profile not found
  - `429` rate limit exceeded

## Endpoint: User State Get
- Method: `GET`
- Path: `/api/user/state`
- Auth:
  - Required `part107_auth` signed cookie
- Response (`200`) shape:
  - `userId: string`
  - `data: Record<string, string | null>`
  - `updatedAt: string`
- Response (`404`) shape:
  - `userId: string`
  - `data: null`
  - `updatedAt: null`
- Error codes:
  - `401` unauthorized
  - `429` rate limit exceeded
- Rate limits:
  - In-memory per-IP limiter: `120` requests/minute

## Endpoint: User State Upsert
- Method: `PUT`
- Path: `/api/user/state`
- Auth:
  - Required `part107_auth` signed cookie
- Request body:
  - `mode: "merge" | "overwrite"`
  - `data: Record<string, unknown>`
- Supported data keys:
  - `part107_progress`
  - `part107_adaptive_stats_v2`
  - `part107_attempt_events_v1`
  - `part107_learning_events_v1`
  - `part107_flashcard_sr`
  - `part107_learn_draft_v1`
- Response (`200`) shape:
  - `userId: string`
  - `updatedAt: string`
  - `changedKeys: string[]`
- Idempotency behavior:
  - If `changedKeys` is empty, server preserves prior `updatedAt` (no-op write).
- Error codes:
  - `400` invalid `mode` or `data`
  - `401` unauthorized
  - `429` rate limit exceeded
- Rate limits:
  - In-memory per-IP limiter: `60` requests/minute

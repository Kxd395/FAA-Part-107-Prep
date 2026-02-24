# Page: Sync Integration

## Page identity
- Route: N/A (cross-cutting API + progress integration)
- Page slug: `sync-integration`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-24
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- Document environment-driven sync behavior across local fallback and managed-store deployments.
- Define auth, integrity, and resiliency expectations for cross-device transfer.

## Deployment modes
| Mode | Required env | Optional env | Storage backend | Auth model |
|------|--------------|--------------|-----------------|------------|
| Local sync store | none | `SYNC_API_TOKEN`, `SYNC_SIGNING_SECRET`, `SYNC_SNAPSHOT_HMAC_SECRET` | file-backed JSON (`apps/web/.data/sync-store-v1.json`) | header user-id fallback or signed session tokens |
| Managed sync store | `SYNC_STORE_URL` | `SYNC_STORE_TOKEN`, `SYNC_API_TOKEN`, `SYNC_SIGNING_SECRET`, `SYNC_SNAPSHOT_HMAC_SECRET` | remote HTTP store (`GET/PUT /sync/:userId`) | same sync auth at app edge; backend token for store hop |

## Auth and session rules
- `POST /api/sync/session` issues signed bearer tokens when `SYNC_SIGNING_SECRET` is configured.
- Signed token TTL is 3600 seconds.
- Progress UI retries sync upload/download once on `401` by refreshing sync session token.
- If `SYNC_SIGNING_SECRET` is unset, sync routes accept `x-sync-user-id` (plus optional static bearer token from `SYNC_API_TOKEN`).

## Snapshot integrity
- When `SYNC_SNAPSHOT_HMAC_SECRET` is configured:
  - server signs persisted snapshots.
  - uploads that include an invalid signature are rejected (`400`).
- Signature payload includes `version`, `exportedAt`, and `data` with deterministic key order.

## Managed-store resiliency
- Remote store calls use:
  - timeout: `5s`
  - retries: 2 retries (`200ms`, `500ms` delays)
  - circuit breaker: opens after 3 consecutive failures, cools down for 30 seconds
- When breaker is open, remote sync requests fail fast to avoid cascading request pressure.

## Observability
- Internal route `/api/_internal/rate-limit-metrics` exposes limiter counters by key.
- If `INTERNAL_METRICS_TOKEN` is set, route requires `Authorization: Bearer <token>`.

## Known limitations
- Internal rate-limit metrics are process-local memory (not aggregated across instances).
- Managed store contract is implicit (`GET/PUT /sync/:userId`), not yet versioned as a separate external spec.

# Sync Contract Draft

## Scope
Draft contract for cross-device continuity of:
- progress sessions (`part107_progress`)
- adaptive stats (`part107_adaptive_stats_v2`)
- learning events (`part107_learning_events_v1`)
- attempt events (`part107_attempt_events_v1`)
- question collections (`part107_question_collections_v1`)

## Current baseline
- Export/import exists as manual transfer from `/progress`.
- Conflict modes implemented: `merge` and `overwrite`.
- Sync API transport exists at `/api/sync/upload` and `/api/sync/download` with header/token auth checks, backed by local server file persistence (`.data/sync-store-v1.json`).

## Proposed contract (draft)
- Identity:
  - user key: `UNKNOWN` (must be stable across devices)
  - auth model: `UNKNOWN`
- Sync unit:
  - snapshot envelope with `version`, `createdAt`, `sourceDevice`, and namespaced payload sections.
- Write model:
  - client batches local mutations and uploads delta or snapshot (`UNKNOWN` final choice).
- Conflict policy:
  - adaptive/question-key records: last-write-wins by timestamp.
  - progress sessions: append by session id; dedupe by deterministic session signature.
  - learning/attempt events: append-only with idempotency by event id.

## API shape (implemented baseline + draft extensions)
### `POST /api/sync/upload`
- Request:
  - `userId: string`
  - `snapshot: SyncSnapshot`
  - `mode: "merge" | "overwrite"`
- Response:
  - `accepted: boolean`
  - `mergedSummary: { changedKeys: string[]; conflicts: number }`

### `GET /api/sync/download`
- Query:
  - `userId: string`
  - optional `since` (`UNKNOWN`, not yet implemented)
- Response:
  - latest accepted `SyncSnapshot`

## Guarantees required before implementation
- Encryption at rest/in transit requirements: `UNKNOWN`
- Retention policy and deletion semantics: `UNKNOWN`
- PII classification for telemetry fields: `UNKNOWN`
- Rate limits and abuse controls: `UNKNOWN`

## Open decisions
1. Should sync be full snapshot only, delta only, or hybrid?
2. What is the offline replay size cap before compaction?
3. Should sink telemetry be part of sync payload or remain local-only?
4. Which server system owns schema/version migrations?

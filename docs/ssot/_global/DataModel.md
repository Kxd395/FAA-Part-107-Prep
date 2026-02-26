# Data Model

## Entities

### Entity: Question
- Purpose: Canonical test/study content rendered by quiz and review flows.
- Identifier: `id` (string, schema pattern `^[A-Z]{2,6}(?:-ACS)?-\d{3}$`).
- Required fields:
  - `id`, `category`, `subcategory`, `question_text`
  - `options[]`, `correct_option_id`
  - `explanation_correct`, `explanation_distractors`
  - `citation`, `difficulty_level`, `acs_code`
- Optional fields:
  - `figure_reference`, `image_ref`, `figure_text`
  - `source_type`, `source`, `tags`, `year_updated`
  - `concept_key` (cross-source semantic grouping key for adaptive ML canonicalization)
- Relationships:
  - Referenced by `ProgressQuestionResult.questionId`
  - Referenced by adaptive stats via canonical key hash
  - Referenced by attempt and learning events
- Ownership/lifecycle:
  - Source files under `packages/content/questions/*.json`
  - External source-pack file `packages/content/knowledge/part107_question_bank.json` (adapted in API layer)
  - External source-pack file `packages/content/knowledge/carrington_question_bank.strict.json` (adapted in API layer)
  - External figure-context helper `packages/content/knowledge/part107_images_needed.json`
  - Legacy fallback paths under `docs/ssot/review/*` retained for compatibility
  - Transformed by sanitizer/normalizer in API route
  - Immutable in client runtime (read-only)

### Entity: ProgressSessionRecord
- Purpose: Local history of completed study/exam sessions for dashboard and missed review.
- Identifier: `id` generated client-side (`<timestamp>-<random>`).
- Storage: `localStorage` key `part107_progress`.
- Required fields:
  - `mode`, `category`, `score`, `total`, `percentage`, `passed`
  - `timestamp`, `timeSpentMs`, `questions[]`
- Optional fields:
  - `questionTypeProfile` (present for exam sessions)
- Relationships:
  - Has many `ProgressQuestionResult`
  - Aggregated by `computeProgressStats`
- Ownership/lifecycle:
  - Created by `saveSession`
  - Read by `/progress` and `/missed`
  - Deleted individually via hook (`deleteSession`) or globally (`clearAll`)

### Entity: UserQuestionStats (adaptive)
- Purpose: Per-user, per-canonical-question performance and scheduling state.
- Identifier: `canonicalKey` scoped by `userId`.
- Storage: `localStorage` key `part107_adaptive_stats_v2` (legacy migrate from `_v1`).
- Core fields:
  - `attempts`, `correct`, `incorrect`, `correctStreak`, `wrongStreak`
  - `lastAttemptAt`, `lastCorrectAt`, `lastResultWasCorrect`
  - `masteryScore`, rolling accuracy/momentum/volatility fields
  - Spaced review fields: `intervalDays`, `nextDueAt`
- Relationships:
  - Updated by study, exam, learn-quiz, and flashcard rating pipelines
  - Used by question selection (`weak_spots`, adaptive selection)
  - Canonicalization uses `concept_key` first when available so paraphrased questions from different source packs update a shared mastery record
- Ownership/lifecycle:
  - Loaded on client start
  - Updated on every graded answer/review
  - Cleared by progress reset flow

### Entity: AttemptEvent
- Purpose: Immutable answer-attempt telemetry for adaptive analysis.
- Identifier: `attemptId` generated client-side.
- Storage: `localStorage` key `part107_attempt_events_v1`.
- Required fields:
  - `questionKey`, `questionId`, `timestamp`, `mode`, `correct`
  - `selectedOptionId`, `responseTimeMs`, `quizId`
  - `topicTags`, `difficulty`, `confidence`
- Constraints:
  - Retains most recent 20,000 events per user.

### Entity: LearningEvent
- Purpose: Event stream for route views, control/filter interactions, study/exam/learn/flashcards lifecycle, and citation/link clicks.
- Identifier: `id` generated client-side.
- Storage: `localStorage` key `part107_learning_events_v1`.
- Required fields:
  - `type`, `mode`, `timestamp`, `userId`
- Optional fields:
  - `questionId`, `category`, `subcategory`
  - `selectedOption`, `correctOption`, `isCorrect`
  - `citationLabel`, `citationUrl`, `questionTypeProfile`, `metadata`
- Supported modes/types:
  - modes: `study|exam|learn|flashcards|home|missed|charts|progress`
  - types: `page_view|control_clicked|filter_changed|tab_changed|link_opened|import_previewed|import_applied|question_shown|answer_submitted|question_skipped|review_opened|citation_clicked|session_started|session_saved|session_resumed|session_completed`
- Constraints:
  - Retains most recent 5,000 events per user.

### Entity: FlashcardSRRecord (legacy)
- Purpose: Previous flashcard-only spaced repetition state.
- Identifier: question ID key in map.
- Storage: `localStorage` key `part107_flashcard_sr`.
- Fields:
  - `due` (timestamp ms)
  - `interval` (ms)
  - `ease` (integer-like growth counter)
- Ownership/lifecycle:
  - No longer updated by the active flashcards flow.
  - Kept only for backward-compatible export/import payloads.

### Entity: LearnDraft
- Purpose: Save/resume state for in-progress learn-mode rounds.
- Identifier: single draft record under a fixed localStorage key.
- Storage: `localStorage` key `part107_learn_draft_v1`.
- Core fields:
  - Setup context: `selectedQuestionType`, `selectedCategory`, `batchSize`, `round`
  - Phase context: `phase` (`teach|quiz|result`), `teachIndex`, `quizIndex` (legacy resume pointer; active quiz consumes queue head)
  - Sequence context: `batchIds[]`, `quizOrderIds[]`
  - Quiz context: `selectedAnswer`, `showResult`, `quizResults[]`
  - Metadata: `updatedAt`, `roundStartedAt`, `version`
- Ownership/lifecycle:
  - Created/updated during learn-mode `teach|quiz|result` phases and on Save & Exit
  - Cleared explicitly by discard/back-to-setup actions
  - Validated on resume; discarded if question IDs cannot be resolved

### Entity: QuestionCollections
- Purpose: User-scoped bookmark and named question sets used by setup filters and bulk missed-question actions.
- Identifier:
  - system collection IDs: `all`, `bookmarks`
  - custom collection IDs: normalized slug (`[a-z0-9-]+`) per user
- Storage: `localStorage` key `part107_question_collections_v1:<userId>`.
- Core fields:
  - `version` (`2`)
  - `bookmarks: string[]`
  - `customCollections[]` with:
    - `id`, `name`, `questionIds[]`, `createdAt`, `updatedAt`
- Ownership/lifecycle:
  - Updated by Study/Exam bookmark toggles and collection create/edit/remove flows.
  - Included in progress export/import snapshots and server user-state/sync tracked keys.

### Entity: QuestionBankSnapshot
- Purpose: Client-side fallback copy of most recent successful `/api/questions` payload.
- Identifier: single record under a fixed localStorage key.
- Storage: `localStorage` key `part107_question_bank_snapshot_v1`.
- Core fields:
  - `version` (`1`)
  - `updatedAt` (ISO timestamp)
  - `source` (`local|remote`)
  - `questions[]`
- Ownership/lifecycle:
  - Written after successful live question-bank fetch.
  - Read only on live-fetch failure after retry/backoff.
  - Freshness policy:
    - soft TTL: 24h (allowed with stale warning)
    - hard TTL: 14d (ignored if older)
  - Optional force-live reload bypasses snapshot fallback for that request.

### Entity: PortableProgressSnapshot
- Purpose: Cross-device manual transfer payload exported/imported from Progress page.
- Identifier: no persistent ID; file payload has `version` and `exportedAt`.
- Storage: downloaded JSON file (user-managed), transient on import.
- Core fields:
  - `version` (currently `1`)
  - `exportedAt` (ISO timestamp)
  - `data` (map of tracked localStorage keys -> raw string/null)
- Included keys:
  - `part107_progress`
  - `part107_adaptive_stats_v2`
  - `part107_attempt_events_v1`
  - `part107_learning_events_v1`
  - `part107_flashcard_sr` (legacy compatibility key)
  - `part107_learn_draft_v1`
  - `part107_question_collections_v1`
- Ownership/lifecycle:
  - Exported on demand from Progress page
  - Imported from Progress page with selectable conflict mode:
    - `merge`: per-key merge rules (dedupe by IDs/timestamps and per-store conflict resolution)
    - `overwrite`: replace tracked keys from snapshot directly
  - Apply flow reloads app shell after write to ensure all hooks/stores hydrate from imported state

### Entity: SyncSessionToken
- Purpose: Short-lived bearer token used to authenticate sync upload/download calls when signed mode is enabled.
- Identifier: signed token payload includes `userId`, `iat`, `exp`, and random nonce.
- Storage: in-memory React state (`syncToken`) on Progress page.
- Core fields:
  - token string format `sync.<payload>.<signature>`
  - expiry `exp` (1 hour from issue)
- Ownership/lifecycle:
  - Issued via `POST /api/sync/session` when `SYNC_SIGNING_SECRET` is configured.
  - Reused for current session until user changes sync user or token expires.
  - Not persisted to localStorage.

### Entity: AppAuthSession
- Purpose: Lightweight app-level user identity session for multi-user persistence APIs.
- Identifier: signed token payload includes `uid` and `exp`.
- Storage: httpOnly cookie `part107_auth`.
- Core fields:
  - token format `app.<payload>.<signature>`
  - `uid` (user id)
  - `exp` (7-day expiry)
  - optional `email`
  - optional `displayName`
- Ownership/lifecycle:
  - Issued by `POST /api/auth/session` (dev flow) or `POST /api/auth/verify` (magic-link flow).
  - Read by authenticated endpoints (`/api/user/state`).
  - Cleared by `DELETE /api/auth/session`.

### Entity: MagicLinkToken
- Purpose: short-lived email sign-in token used by verify endpoint.
- Identifier: signed token payload (`email`, `exp`, `nonce`).
- Storage: no persistence required (self-contained signed token).
- Core fields:
  - token format `magic.<payload>.<signature>`
  - `email`
  - `exp` (~15 minute expiry)
  - `nonce`
- Ownership/lifecycle:
  - Issued by `POST /api/auth/magic-link`.
  - Verified by `POST /api/auth/verify`.

### Entity: UserProfile
- Purpose: durable account identity/profile metadata.
- Identifier: `id` (user id).
- Storage:
  - file-backed JSON store at `apps/web/.data/user-profiles-v1.json`.
- Core fields:
  - `id`
  - `email`
  - `displayName`
  - `avatarUrl`
  - `createdAt`
  - `updatedAt`
- Ownership/lifecycle:
  - Created/loaded by `findOrCreateUserByEmail` during magic-link verification.
  - Read by `GET /api/user/profile`.
  - Updated by `PATCH /api/user/profile`.

### Entity: UserStateRecord
- Purpose: Server-side per-user persistence snapshot for learning/adaptive/progress data.
- Identifier: `userId`.
- Storage:
  - file-backed JSON store at `apps/web/.data/user-state-v1.json` (in-memory cache on server process).
- Core fields:
  - `userId`
  - `updatedAt`
  - `data` (tracked key/value map):
    - `part107_progress`
    - `part107_adaptive_stats_v2`
    - `part107_attempt_events_v1`
    - `part107_learning_events_v1`
    - `part107_flashcard_sr`
    - `part107_learn_draft_v1`
    - `part107_question_collections_v1`
- Ownership/lifecycle:
  - Upserted by `PUT /api/user/state` in `merge|overwrite` mode.
  - No-op upserts (no changed keys) preserve prior `updatedAt`.
  - Read by `GET /api/user/state`.

### Entity: SyncSnapshotEnvelope
- Purpose: Server-side sync payload container for upload/download, including optional integrity signature.
- Identifier: no unique ID; envelope keyed by `userId` in sync record storage.
- Core fields:
  - `version` (`1`)
  - `exportedAt` (ISO timestamp)
  - `data` (tracked local storage key/value map)
  - `signature?` (HMAC signature over version/exportedAt/data)
- Ownership/lifecycle:
  - Accepted by `/api/sync/upload`, validated (when signature present and secret configured), merged, then persisted.
  - Returned by `/api/sync/download`.

### Entity: SyncRecord
- Purpose: Persisted server-side snapshot per sync user.
- Identifier: `userId`.
- Storage:
  - Default: file-backed JSON store at `apps/web/.data/sync-store-v1.json` (in-memory cache on server process).
  - Optional managed mode: remote HTTP store via `SYNC_STORE_URL` (+ optional `SYNC_STORE_TOKEN`).
- Core fields:
  - `userId`
  - `snapshot: SyncSnapshotEnvelope`
  - `updatedAt`
- Ownership/lifecycle:
  - Upserted on each successful sync upload merge.
  - Read by sync download endpoint.

### Entity: LearningAnalyticsEvent (server)
- Purpose: Server-ingested analytics row used for backend scoring summaries and ML feature extraction.
- Identifier: `id` (event ID).
- Storage:
  - file-backed JSON store at `apps/web/.data/learning-analytics-v1.json` (in-memory cache on server process).
- Core fields:
  - `id`, `userId`, `timestamp`, `type`, `mode`
  - optional `questionId`, `category`, `subcategory`, `isCorrect`, `questionTypeProfile`, `metadata`
- Ownership/lifecycle:
  - Written by `POST /api/user/learning-events`.
  - Deduped by event ID per user.
  - Retention cap: 20,000 events per user.

### Entity: LearningScoringSummary
- Purpose: Pre-aggregated scoring metrics for dashboard and ML calibration checks.
- Identifier: computed view (no persisted ID).
- Source:
  - derived from server `LearningAnalyticsEvent` rows in `GET /api/user/scoring/summary`.
- Core fields:
  - `answerCount`, `correctCount`, `accuracyPercent`
  - `uniqueQuestionCount`, `firstAnswerAccuracyPercent`, `finalAnswerAccuracyPercent`, `answerChangeRatePercent`
  - `confidenceCount`, `calibrationScorePercent`, `overconfidenceRatePercent`
  - `byMode`

### Entity: TelemetrySupportBundle (redacted export)
- Purpose: User-downloadable debugging payload that excludes question text/IDs and answer selections.
- Identifier: none persistent; file payload has `version` and `exportedAt`.
- Storage: downloaded JSON file (user-managed).
- Core fields:
  - `version`, `exportedAt`, `userId`
  - `learningEvents` aggregate counts + redacted event list (`type`, `mode`, `timestamp`, optional metadata/isCorrect/profile)
  - `attemptEvents` aggregate counts + redacted attempt list (`mode`, `timestamp`, `correct`, `responseTimeMs`, etc.)
- Ownership/lifecycle:
  - Exported from Progress page via `Export Telemetry`
  - Intended for support/debug workflows and issue triage

## Data invariants
- `ProgressSessionRecord.percentage` is derived as `round(score / total * 100)`.
- `ProgressSessionRecord.passed` is derived with threshold `>= 70`.
- `ProgressQuestionResult` entries must map to question IDs from the question bank; stale IDs are ignored in missed-review join.
- Adaptive stats are keyed by canonicalized question text (+ choices, by config).
- Attempt/learning event stores are append-only within retention window.
- Question API sanitization runs before category/type filtering.
- Learn draft resume requires all referenced `batchIds`/`quizOrderIds` to resolve against current question bank.
- Question snapshot fallback is only eligible when `age <= 14 days`; older snapshots are ignored.
- Learn progress persistence stores first-pass outcomes per question for each saved learn round; retries are excluded from `ProgressSessionRecord.questions`.
- Portable snapshot import must have `version=1` and object-shaped `data`; malformed payloads are rejected.
- Merge-mode import invariants:
  - `part107_progress` dedupes by session `id`, latest timestamp wins.
  - `part107_attempt_events_v1` dedupes by `attemptId` and retains cap window.
  - `part107_learning_events_v1` dedupes by event `id` and retains cap window.
  - `part107_adaptive_stats_v2` prefers higher `attempts`, then latest `lastAttemptAt`.
  - `part107_learn_draft_v1` keeps the newest `updatedAt`.
- Progress reset-scope invariants:
  - `progress` scope clears `part107_progress` only.
  - `adaptive` scope clears adaptive stats and flashcard schedule.
  - `telemetry` scope clears learning/attempt event streams.
  - `all` scope clears all above plus learn draft.
- Sync invariants:
  - Signed-auth mode is activated only when `SYNC_SIGNING_SECRET` is configured.
  - Sync upload `payload.userId` must equal authenticated sync user ID.
  - Snapshot signatures are validated only when `SYNC_SNAPSHOT_HMAC_SECRET` is configured and a signature is provided.
- App auth/user-state invariants:
  - `/api/user/state` requires valid `part107_auth` cookie and always resolves `userId` from server-side token payload.
  - User-state writes only accept tracked persistence keys; unknown keys are ignored.

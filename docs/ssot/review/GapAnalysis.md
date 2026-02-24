# SSOT Gap Analysis

## Executive summary
- What is solid:
  - Core route surface and primary quiz workflows are implemented and readable.
  - Question API contract is straightforward and deterministic.
  - Local analytics/adaptive/progress data models are explicit and versioned for most stores.
  - Study mode now supports `Skip for now` and partial `Save & Exit`.
  - Flashcards now uses adaptive due-order queueing with in-session reinsertion for `Still Learning`.
  - Learn mode now supports `Skip for now`, `Save & Exit`, session resume/discard, and queue reinsertion parity in quiz mode.
  - Learn results now report first-pass accuracy and eventual mastery separately.
  - Learn and flashcards now emit learning-event telemetry for session lifecycle and card/question actions.
  - Progress overview now surfaces local learning-event activity with mode/type/time/search filters.
  - Progress now supports export/import of local learning data snapshots with preview and merge/overwrite conflict modes.
  - Progress reset now supports scoped clearing (all/progress/adaptive/telemetry) and redacted telemetry support exports.
  - Home, charts, and missed routes now emit route/link/filter telemetry for funnel and behavior visibility.
  - Missed and progress history surfaces now use load-more pagination to reduce initial render cost.
  - Reference modal now enforces focus trap and restores prior focus on close.
  - Question loading now uses retry/backoff with cached snapshot fallback and shared load/error presentation.
  - `/api/questions` and remote-source payloads now have runtime contract validation with tests.
  - Learning-event writes now enforce taxonomy/schema validation before persistence/sink forwarding.
  - Learn/flashcards queue reinsertion now runs through a shared tested utility for parity.
  - Setup zero-question states now use a shared component with consistent recovery guidance.
  - Sync API now has implemented upload/download endpoints with auth ownership checks and merge behavior.
  - Snapshot fallback UI now exposes snapshot-age context and explicit cache-clear recovery control.
  - Progress and missed pages now include virtualization fallback for extreme list sizes.
  - Learn resume/save-exit behavior now has route-level test coverage.
  - Progress now includes explicit sync controls (upload/download with conflict preview) and analytics dead-letter queue diagnostics.
  - API routes now include baseline per-IP rate limiting with `429` handling.
  - Sync now supports signed session tokens (`/api/sync/session`), optional snapshot integrity signatures, and internal rate-limit metrics visibility.
  - Phase-1 multi-user backend foundation is now in place with cookie auth sessions and authenticated per-user state APIs (`/api/auth/session`, `/api/user/state`).
- What is ambiguous:
  - Ownership, long-term source-of-truth for metrics/counts, and server-side data strategy.
  - Permission and threat model assumptions (currently effectively public-only).
  - Accessibility conformance targets and acceptance criteria.
- What is risky:
  - Public full-bank data exposure via unauthenticated API.
  - Local-only persistence with no integrity guarantees.
  - Inconsistent instrumentation and state handling across learning modes.

## Missing requirements (blockers)
These prevent correct implementation.
1. Product-level auth/identity requirements are undefined. The app behaves as fully public, but there is no confirmed requirement whether this is acceptable long term.
2. Data ownership and persistence requirements are undefined (local-only vs cloud sync). Without this, progress/adaptive behavior cannot be treated as durable.
3. API ownership for remote question source (`QUESTION_SOURCE_URL`) is undefined. No explicit schema governance, SLA, or fallback policy exists.
4. Accessibility compliance target (WCAG level, supported assistive tech, keyboard interaction contract) is undefined.

## Missing decisions (non-blocking but dangerous)
These cause inconsistent behavior.
1. Ownership and schema governance for remote analytics sink ingestion is still undefined.
2. Analytics retention, redaction policy, and sink operational SLOs are undefined.
3. Cloud sync conflict policy and multi-instance backing store guarantees are still undefined beyond single-environment file persistence.

## Consistency problems
- Navigation inconsistencies:
  - No breadcrumb system despite deep linked query-state routes.
  - Some completion pages offer explicit onward links; others require header nav.
- Permission model inconsistencies:
  - Global docs previously implied unknown roles; actual code enforces none.
- Error handling inconsistencies:
  - Question-bank fetch failures now use shared components; non-question errors (import/remote sync) still vary in presentation depth and recovery guidance.
- Data model inconsistencies:
  - Progress has explicit versionless payload; adaptive/events are versioned.
  - Flashcard SR store is unversioned compared to adaptive/event stores.
- Analytics naming inconsistencies:
  - Header and route-level instrumentation exists, but support/debug event naming conventions are not yet formally governed.

## High-risk flows
- Flow: Public question API extraction
  - Failure modes: scraping, redistribution, abuse traffic
  - Suggested hardening: auth gating or signed access, rate limits, anti-bot controls, monitoring
- Flow: Local reset data action
  - Failure modes: accidental irreversible data loss
  - Suggested hardening: export-before-reset, soft-delete window, confirm with explicit scope
- Flow: Remote question source integration
  - Failure modes: malformed payload, upstream outage, silently degraded UX
  - Suggested hardening: schema validation with strict rejection metrics, cached fallback snapshot, health checks

## UX debt and dark corners
- Unreachable states:
  - Some route states assume non-empty pools; behavior for zero pools is not uniformly surfaced.
- Confusing empty states:
  - Users can land in disabled-start states without actionable guidance on how to recover filters.
- Missing onboarding or explanation:
  - Query parameter effects (`type`, `focus`) are implicit and not globally explained.
- Form validation brittleness:
  - Invalid params are downgraded with warnings in some routes but silently normalized elsewhere.
- In-session consistency:
  - Save/resume now exists in learn mode, but cross-mode persistence semantics still differ (learn has explicit draft resume; flashcards is queue-based and session-ephemeral).
- Transfer consistency:
  - Cross-device continuity exists via export/import, but it is manual and not discoverable outside progress settings.

## Tech debt and maintainability
- Over-coupled components:
  - Route pages own substantial orchestration and UI logic; reuse opportunities are limited.
- Unbounded state:
  - Progress store can grow without explicit cap; history rendering can become heavy.
- Fragile caching:
  - Snapshot fallback exists, but no background refresh/compaction worker yet.
- Missing contract tests:
  - `/api/questions` local/remote paths are covered; sink transport contract tests are still shallow.

## Security audit notes
- Authorization enforcement gaps:
  - None present today; all actions are public.
- Logging of sensitive data risks:
  - Detailed user attempt history in localStorage without encryption or access controls.
- ID-based access patterns to review:
  - Question IDs and canonical keys are exposed client-side and can be enumerated.

## Performance audit notes
- Largest data rendering risks:
  - History and missed lists now paginate and virtualize large renders, but client-side filter/sort passes still process full arrays.
- Pagination or virtualization missing:
  - Virtualization fallback now exists for review-heavy pages; thresholds and row-height estimates still need production tuning.
- Overfetching risks:
  - Full question bank fetched for each learning mode route mount.

## Accessibility audit notes
- Keyboard traps:
  - Reference modal focus trap is implemented; cross-browser keyboard QA is still needed.
- Focus management missing:
  - Modal focus restoration is implemented; route-level landmark/focus flow is still not fully audited.
- Screen reader labeling missing:
  - Expand/collapse controls and icon-only modal close now include ARIA semantics; broader labeling audit remains.

## Roadmap (prioritized)
### P0 (must do)
- Define and approve auth/data persistence requirements (public-only vs authenticated product).
- Add API ownership + upstream SLA policy for `QUESTION_SOURCE_URL` providers.
- Add cross-device sync strategy (beyond manual export/import) for adaptive/progress continuity.

### P1 (should do)
- Unify analytics instrumentation across all routes and document event naming conventions.
- Define event taxonomy governance and sink contract now that route instrumentation is in place.
- Upgrade sync storage from local filesystem persistence to shared managed datastore for multi-instance deployments.
- Replace hardcoded virtualization thresholds with measured tuning and benchmark guardrails.

### P2 (nice to have)
- Add cloud sync for progress/adaptive/SR stores.
- Build breadcrumb conventions and deep-link explainability.
- Add automated link checking for FAA external references.

## Action log
Keep this current so SSOT stays alive.
| Date | Change | Files updated | Owner |
|------|--------|--------------|-------|
| 2026-02-24 | Generated initial global + per-route SSOT docs from live codebase | `docs/ssot/_global/*.md`, `docs/ssot/pages/*.md`, `docs/ssot/review/GapAnalysis.md` | Codex |
| 2026-02-24 | Filled SSOT ownership metadata, set ticket references, and added PR SSOT checklist gate | `docs/ssot/README.md`, `docs/ssot/pages/*.md`, `.github/PULL_REQUEST_TEMPLATE.md` | @kevindialmb |
| 2026-02-24 | Fixed study/flashcards interaction gaps (skip/save-exit + deterministic flashcard progression) and updated SSOT docs | `packages/core/src/studySession.ts`, `apps/web/src/app/study/page.tsx`, `apps/web/src/app/flashcards/page.tsx`, `docs/ssot/pages/study.md`, `docs/ssot/pages/flashcards.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Reworked flashcards to adaptive due scheduling + in-session reinsertion for Still Learning | `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/lib/attemptEventStore.ts`, `docs/ssot/pages/flashcards.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Implemented learn-mode skip/save-exit/resume and synced SSOT docs | `apps/web/src/app/learn/page.tsx`, `apps/web/src/lib/learnDraftStore.ts`, `docs/ssot/pages/learn.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Applied queue reinsertion model to learn quiz mode (incorrect answers cycle back, correct answers dequeue) | `apps/web/src/app/learn/page.tsx`, `docs/ssot/pages/learn.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added learn first-pass vs mastery scoring, deduped progress persistence, and adaptive telemetry updates | `apps/web/src/app/learn/page.tsx`, `docs/ssot/pages/learn.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added learning-event instrumentation parity for learn/flashcards (question shown/submitted/skipped + session lifecycle) | `apps/web/src/app/learn/page.tsx`, `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/lib/learningEventStore.ts`, `docs/ssot/_global/AnalyticsSchema.md`, `docs/ssot/pages/learn.md`, `docs/ssot/pages/flashcards.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added progress overview visibility for learning-event telemetry (mode/type/recent) and updated SSOT docs | `apps/web/src/app/progress/page.tsx`, `docs/ssot/pages/progress.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added progress export/import for manual cross-device transfer and updated SSOT contracts | `apps/web/src/app/progress/page.tsx`, `docs/ssot/pages/progress.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/_global/ErrorCatalog.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added analytics taxonomy + optional sink forwarding, route instrumentation (home/charts/missed/progress), import merge preview/apply model, and progress telemetry filters/trends | `apps/web/src/lib/analyticsTaxonomy.ts`, `apps/web/src/lib/analyticsSink.ts`, `apps/web/src/hooks/useLearningEventLogger.ts`, `apps/web/src/app/page.tsx`, `apps/web/src/app/charts/page.tsx`, `apps/web/src/app/missed/page.tsx`, `apps/web/src/app/progress/page.tsx`, `apps/web/src/lib/progressImportMerge.ts`, `apps/web/src/lib/progressImportMerge.test.ts`, `docs/ssot/_global/AnalyticsSchema.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/pages/home.md`, `docs/ssot/pages/charts.md`, `docs/ssot/pages/missed.md`, `docs/ssot/pages/progress.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed follow-up 7 fixes: progress import integration tests, reset scope controls, telemetry support export, header nav analytics, missed/history pagination, modal focus trap/restore, and Next.js cache recovery script/docs | `apps/web/src/app/progress/page.tsx`, `apps/web/src/app/progress/page.test.tsx`, `apps/web/src/app/missed/page.tsx`, `apps/web/src/components/ReferenceModal.tsx`, `apps/web/src/components/AppHeaderNav.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/lib/telemetrySupportBundle.ts`, `apps/web/src/lib/telemetrySupportBundle.test.ts`, `apps/web/package.json`, `tools/clear-next-cache.sh`, `docs/troubleshooting/nextjs-dev-cache.md`, `docs/ssot/_global/AnalyticsSchema.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/pages/progress.md`, `docs/ssot/pages/missed.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed confidence-aware grading pass: unified `q` scoring, quality-based queue reinsertion, split-confidence answer controls, learn/study/exam/flashcards parity, and calibration/overconfidence metrics with SSOT updates | `packages/core/src/grading.ts`, `packages/core/src/grading.test.ts`, `packages/core/src/adaptive.ts`, `packages/core/src/adaptive.test.ts`, `packages/core/src/studySession.ts`, `apps/web/src/components/quiz/AnswerOptions.tsx`, `apps/web/src/components/quiz/AnswerOptions.test.tsx`, `apps/web/src/app/study/page.tsx`, `apps/web/src/app/exam/page.tsx`, `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/app/learn/page.tsx`, `apps/web/src/hooks/useAdaptiveQuestionStats.ts`, `apps/web/src/lib/adaptiveInsights.ts`, `apps/web/src/lib/adaptiveInsights.test.ts`, `apps/web/src/lib/learnDraftStore.ts`, `docs/ssot/pages/study.md`, `docs/ssot/pages/exam.md`, `docs/ssot/pages/flashcards.md`, `docs/ssot/pages/learn.md`, `docs/ssot/pages/progress.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed reliability/accessibility/governance pass: shared question load/error UI, retry+backoff with cached snapshot fallback, API contract parsing for local/remote payloads, telemetry schema validation, flashcard flip regression coverage, and live-region announcements | `apps/web/src/components/QuestionBankState.tsx`, `apps/web/src/hooks/useQuestionBank.ts`, `apps/web/src/hooks/useQuestionBank.test.tsx`, `apps/web/src/lib/questionContracts.ts`, `apps/web/src/lib/questionContracts.test.ts`, `apps/web/src/lib/learningEventSchema.ts`, `apps/web/src/lib/learningEventSchema.test.ts`, `apps/web/src/hooks/useLearningEventLogger.ts`, `apps/web/src/app/api/questions/route.ts`, `apps/web/src/app/flashcards/page.test.tsx`, `apps/web/src/app/study/page.tsx`, `apps/web/src/app/exam/page.tsx`, `apps/web/src/app/learn/page.tsx`, `apps/web/src/app/missed/page.tsx`, `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/lib/questionBank.ts`, `apps/web/vitest.config.ts`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/_global/ErrorCatalog.md`, `docs/ssot/pages/study.md`, `docs/ssot/pages/exam.md`, `docs/ssot/pages/learn.md`, `docs/ssot/pages/flashcards.md`, `docs/ssot/pages/missed.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed parity + resiliency follow-up: shared queue reinsertion utility/tests, `/api/questions` integration tests, zero-question setup-state parity component, keyboard/live-region accessibility checks, sink contract tests, snapshot TTL + force-live refresh control, and sync contract draft | `apps/web/src/lib/queueReinsertion.ts`, `apps/web/src/lib/queueReinsertion.test.ts`, `apps/web/src/app/learn/page.tsx`, `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/app/api/questions/route.test.ts`, `apps/web/src/components/QuestionSelectionEmptyState.tsx`, `apps/web/src/components/QuestionBankState.tsx`, `apps/web/src/components/QuestionBankState.test.tsx`, `apps/web/src/app/study/page.tsx`, `apps/web/src/app/exam/page.tsx`, `apps/web/src/app/missed/page.tsx`, `apps/web/src/hooks/useQuestionBank.ts`, `apps/web/src/hooks/useQuestionBank.test.tsx`, `apps/web/src/lib/analyticsSink.test.ts`, `apps/web/src/app/flashcards/page.test.tsx`, `docs/ssot/_global/SyncContractDraft.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/_global/AnalyticsSchema.md`, `docs/ssot/README.md`, `docs/ssot/pages/study.md`, `docs/ssot/pages/exam.md`, `docs/ssot/pages/learn.md`, `docs/ssot/pages/flashcards.md`, `docs/ssot/pages/missed.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed follow-up implementation pass: sync upload/download APIs with auth ownership checks + tests, analytics sink retry/dead-letter flow, expanded question-route query tests, learn save/resume route tests, snapshot age/clear controls, and large-list virtualization fallback with SSOT refresh | `apps/web/src/app/api/sync/upload/route.ts`, `apps/web/src/app/api/sync/upload/route.test.ts`, `apps/web/src/app/api/sync/download/route.ts`, `apps/web/src/app/api/sync/download/route.test.ts`, `apps/web/src/lib/server/syncAuth.ts`, `apps/web/src/lib/server/syncStore.ts`, `apps/web/src/lib/analyticsSink.ts`, `apps/web/src/lib/analyticsSink.test.ts`, `apps/web/src/app/api/questions/route.test.ts`, `apps/web/src/app/learn/page.test.tsx`, `apps/web/src/hooks/useQuestionBank.ts`, `apps/web/src/hooks/useQuestionBank.test.tsx`, `apps/web/src/components/QuestionBankState.tsx`, `apps/web/src/components/QuestionBankState.test.tsx`, `apps/web/src/app/study/page.tsx`, `apps/web/src/app/exam/page.tsx`, `apps/web/src/app/learn/page.tsx`, `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/app/missed/page.tsx`, `apps/web/src/app/progress/page.tsx`, `apps/web/src/app/progress/page.test.tsx`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/_global/ErrorCatalog.md`, `docs/ssot/_global/AnalyticsSchema.md`, `docs/ssot/pages/study.md`, `docs/ssot/pages/exam.md`, `docs/ssot/pages/learn.md`, `docs/ssot/pages/flashcards.md`, `docs/ssot/pages/missed.md`, `docs/ssot/pages/progress.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed next hardening pass: durable local sync-store persistence, progress sync/dead-letter diagnostics UI, per-key conflict details, API rate limiting, added sync/dead-letter tests, and virtualization threshold benchmark notes | `apps/web/src/lib/server/syncStore.ts`, `apps/web/src/lib/server/rateLimit.ts`, `apps/web/src/app/api/questions/route.ts`, `apps/web/src/app/api/questions/route.test.ts`, `apps/web/src/app/api/sync/upload/route.ts`, `apps/web/src/app/api/sync/download/route.ts`, `apps/web/src/app/api/sync/upload/route.test.ts`, `apps/web/src/app/api/sync/download/route.test.ts`, `apps/web/src/app/progress/page.tsx`, `apps/web/src/app/progress/page.test.tsx`, `apps/web/src/lib/analyticsSink.ts`, `docs/performance/virtualization-thresholds.md`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/_global/ErrorCatalog.md`, `docs/ssot/_global/AnalyticsSchema.md`, `docs/ssot/_global/SyncContractDraft.md`, `docs/ssot/pages/progress.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed sync/auth hardening pass: signed sync session tokens, snapshot signature validation/signing, optional managed sync store path, rate-limit metrics endpoint, progress sync token wiring, and dead-letter exponential retry metadata with SSOT refresh | `apps/web/src/lib/server/syncToken.ts`, `apps/web/src/app/api/sync/session/route.ts`, `apps/web/src/app/api/sync/session/route.test.ts`, `apps/web/src/lib/server/syncAuth.ts`, `apps/web/src/lib/server/snapshotSignature.ts`, `apps/web/src/lib/server/syncStore.ts`, `apps/web/src/app/api/sync/upload/route.ts`, `apps/web/src/app/api/sync/download/route.ts`, `apps/web/src/lib/server/rateLimit.ts`, `apps/web/src/app/api/_internal/rate-limit-metrics/route.ts`, `apps/web/src/app/api/_internal/rate-limit-metrics/route.test.ts`, `apps/web/src/app/progress/page.tsx`, `apps/web/src/app/progress/page.test.tsx`, `apps/web/src/lib/analyticsSink.ts`, `apps/web/src/lib/analyticsSink.test.ts`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/_global/ErrorCatalog.md`, `docs/ssot/_global/AnalyticsSchema.md`, `docs/ssot/pages/progress.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed follow-up 7: internal metrics auth gate, sync 401 token-refresh retry, remote sync-store timeout/retry/circuit-breaker behavior + tests, import conflict winner summary, dead-letter next-retry UI gating, sync roundtrip route test, and sync integration SSOT doc | `apps/web/src/app/api/_internal/rate-limit-metrics/route.ts`, `apps/web/src/app/api/_internal/rate-limit-metrics/route.test.ts`, `apps/web/src/app/progress/page.tsx`, `apps/web/src/app/progress/page.test.tsx`, `apps/web/src/lib/server/syncStore.ts`, `apps/web/src/lib/server/syncStore.remote.test.ts`, `apps/web/src/app/api/sync/roundtrip.test.ts`, `docs/ssot/README.md`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/_global/ErrorCatalog.md`, `docs/ssot/pages/progress.md`, `docs/ssot/pages/sync-integration.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Switched learn/study confidence UX to explicit post-selection confidence step (1-5 before reveal), removed split confidence answer buttons, and updated SSOT behavior contracts | `apps/web/src/app/learn/page.tsx`, `apps/web/src/app/study/page.tsx`, `apps/web/src/components/quiz/AnswerOptions.tsx`, `docs/ssot/pages/learn.md`, `docs/ssot/pages/study.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Switched flashcards rating to explicit two-step grading (select outcome, then confidence 1-5), updated keyboard shortcuts and tests, and refreshed flashcards SSOT contract | `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/app/flashcards/page.test.tsx`, `docs/ssot/pages/flashcards.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Implemented Phase-1 multi-user backend base: signed app auth session cookie routes, authenticated per-user learning state APIs with merge/overwrite semantics, server user-state persistence, tests, and SSOT contract updates | `apps/web/src/lib/server/appAuth.ts`, `apps/web/src/lib/server/userStateStore.ts`, `apps/web/src/app/api/auth/session/route.ts`, `apps/web/src/app/api/auth/session/route.test.ts`, `apps/web/src/app/api/user/state/route.ts`, `apps/web/src/app/api/user/state/route.test.ts`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/_global/PermissionsMatrix.md`, `docs/ssot/_global/ErrorCatalog.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added split-confidence `high_only` behavior for Study answers, switched Flashcards to one-click default confidence with optional `☑` high-confidence actions, hydrated Progress auth session on load, and updated tests/SSOT docs | `apps/web/src/components/quiz/AnswerOptions.tsx`, `apps/web/src/components/quiz/AnswerOptions.test.tsx`, `apps/web/src/app/study/page.tsx`, `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/app/flashcards/page.test.tsx`, `apps/web/src/app/progress/page.tsx`, `apps/web/src/app/progress/page.test.tsx`, `docs/ssot/pages/study.md`, `docs/ssot/pages/flashcards.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Completed shared learning-attempt pipeline pass: centralized `answer_submitted` + adaptive attempt writes across Study/Learn/Flashcards/Exam, made user-state updates idempotent when unchanged, auto-loaded account state after sign-in, and refreshed SSOT coverage | `apps/web/src/lib/learningAttemptPipeline.ts`, `apps/web/src/lib/learningAttemptPipeline.test.ts`, `apps/web/src/app/study/page.tsx`, `apps/web/src/app/learn/page.tsx`, `apps/web/src/app/flashcards/page.tsx`, `apps/web/src/app/exam/page.tsx`, `apps/web/src/lib/server/userStateStore.ts`, `apps/web/src/app/api/user/state/route.test.ts`, `apps/web/src/app/progress/page.tsx`, `docs/ssot/pages/study.md`, `docs/ssot/pages/learn.md`, `docs/ssot/pages/flashcards.md`, `docs/ssot/pages/exam.md`, `docs/ssot/pages/progress.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added single-file architecture ASCII blueprint covering page topology, API/data flow, adaptive ML loop, sync/auth path, and storage map; linked in SSOT index | `docs/ssot/ArchitectureAscii.md`, `docs/ssot/README.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added auth-core verification coverage and SSOT auth/profile contract updates: magic-link + verify route tests, user-profile route tests, and global API/data/permissions/error catalog refresh | `apps/web/src/app/api/auth/magic-link/route.test.ts`, `apps/web/src/app/api/auth/verify/route.test.ts`, `apps/web/src/app/api/user/profile/route.test.ts`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/_global/DataModel.md`, `docs/ssot/_global/PermissionsMatrix.md`, `docs/ssot/_global/ErrorCatalog.md`, `docs/ssot/ArchitectureAscii.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Fixed startup/auth discoverability pass: header `Sign In/Sign Out` control, `/login` suspense-safe build fix, dev magic-link URL surfaced in UI, dev startup defaults to cache-clean launch, and SSOT route/auth docs refreshed | `apps/web/src/components/AppHeaderNav.tsx`, `apps/web/src/app/login/page.tsx`, `apps/web/src/app/api/auth/magic-link/route.ts`, `apps/web/package.json`, `docs/ssot/_global/NavigationMap.md`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/pages/login.md`, `docs/ssot/ArchitectureAscii.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Added startup-hang guardrails for local dev: Node 20 LTS enforcement script, IPv4 host binding in dev scripts, and updated troubleshooting/onboarding docs | `tools/check-node-version.js`, `apps/web/package.json`, `docs/troubleshooting/nextjs-dev-cache.md`, `README.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |
| 2026-02-24 | Verified and hardened Google auth pass: added `/api/auth/google` tests, fixed auth-related lint/test regressions, removed committed OAuth client secret artifact, and updated SSOT login/API contracts | `apps/web/src/app/api/auth/google/route.test.ts`, `apps/web/src/app/login/page.tsx`, `apps/web/src/app/progress/page.test.tsx`, `apps/web/src/lib/server/passwordAuth.test.ts`, `apps/web/src/lib/server/userProfileStore.test.ts`, `apps/web/src/middleware.test.ts`, `.gitignore`, `docs/ssot/_global/APIContracts.md`, `docs/ssot/pages/login.md`, `docs/ssot/review/GapAnalysis.md` | @kevindialmb |

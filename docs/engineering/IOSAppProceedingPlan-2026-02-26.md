# iOS App Proceeding Plan

Date: 2026-02-26

## Current State (as audited)

- iOS track currently has Swift source scaffolding only:
  - `apps/ios/Part107Prep/Part107PrepApp.swift`
  - `apps/ios/Part107Prep/Models/Question.swift`
  - `apps/ios/Part107Prep/ViewModels/QuizViewModel.swift`
- No committed Xcode project/workspace, no CI build lane, no XCTest target, no backend integration layer.
- Current iOS data load is local-bundle JSON only, while web has server-backed state, analytics, sync, issue reporting, and Supabase-backed persistence.

## Recommendation Summary

Proceed with iOS now, but **as a platform foundation phase first**, not feature expansion first.

Target order:
1. Production foundation (project, CI, API client, auth contract)
2. Parity for core session flows (Study/Exam)
3. Sync + analytics + issue reporting parity
4. Flashcards/Learn refinement and offline optimization

## Architecture Decision

Use a **hybrid model**:
- Server of record: Postgres via Supabase (already configured for web APIs).
- Mobile local cache: SQLite on-device for offline-first UX and low-latency reads.

Why:
- Supabase/Postgres is right for cross-device history, analytics aggregates, and scoring services.
- SQLite is right for on-device queueing, offline session continuity, and fast question retrieval.
- This avoids forcing iOS to be always-online while still keeping shared analytics/scoring authoritative.

## Phase Plan

## Phase 0 (1 week): Bootstrap and contract freeze

Deliverables:
- Commit an actual Xcode project/workspace under `apps/ios/`.
- Add targets/schemes for iOS and test bundle.
- Lock API contracts iOS will consume from web backend:
  - `/api/questions`
  - `/api/user/state`
  - `/api/user/learning-events`
  - `/api/user/question-issues`
  - `/api/user/scoring/summary`
  - `/api/sync/*`
- Define mobile auth contract (token-based for app clients; do not rely on browser cookie semantics).

Exit criteria:
- iOS builds in CI
- Auth and questions endpoints reachable from simulator

## Phase 1 (2 weeks): Core production skeleton

Deliverables:
- `NetworkClient` with typed request/response models aligned to `docs/ssot/_global/APIContracts.md`.
- `AuthManager` for mobile-safe session token storage (Keychain).
- `TelemetryClient` for `answer_submitted`, `question_shown`, `session_*`, and confidence events.
- `IssueReporter` UI in-session (one-line note + question context, one tap).
- Replace `print` diagnostics with structured logger abstraction.

Exit criteria:
- Study and Exam run against API-backed question payloads
- Event and issue submissions succeed for authenticated user

## Phase 2 (2 weeks): Learning/scoring parity

Deliverables:
- Mirror confidence model and one-touch answer UX from web.
- Implement adaptive score hydration from backend summary endpoint.
- Add answer-order randomization on each run while preserving deterministic review mode.
- Add image/figure rendering pipeline parity for image-based questions.

Exit criteria:
- iOS and web produce comparable scoring inputs and confidence telemetry
- Image-required questions are never shown without a valid figure payload

## Phase 3 (2 weeks): Offline + sync hardening

Deliverables:
- SQLite-backed queue for pending events/issues/session deltas.
- Background sync worker with retry/backoff and idempotency keys.
- Conflict strategy: merge for events, LWW for mutable profile/state keys.
- Performance instrumentation (cold start, question render latency, sync latency).

Exit criteria:
- App usable offline for active sessions
- Replay/sync stable after reconnect

## Non-Negotiable Standards for iOS

1. Typed models generated or validated from shared contracts.
2. XCTest coverage gates for core logic and networking.
3. No direct service-role key usage on device.
4. Secure storage (Keychain) for tokens.
5. Structured logs + request IDs propagated from backend.

## What to Build First (highest ROI)

1. Mobile auth contract + token flow
2. API-backed question loading + image-safe rendering guard
3. In-session issue reporting and telemetry parity
4. SQLite cache and replay queue

## Risks and Mitigations

- Risk: cookie-based web auth does not translate cleanly to native mobile.
- Mitigation: introduce mobile token contract and explicit expiry/refresh semantics.

- Risk: drift between web and iOS grading/confidence logic.
- Mitigation: centralize scoring in shared backend endpoints and shared contract tests.

- Risk: image-based questions become unanswerable without figure mapping.
- Mitigation: preflight filter to exclude any unresolved figure payload before session start.

## Recommendation on Starting iOS Now

Yes, start now, but only after Phase 0 contract and project bootstrap are complete.  
Do not spend effort on additional iOS UI polish before auth/API/sync foundations are in place.

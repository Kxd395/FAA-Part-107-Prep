# Page: Flashcards

## Page identity
- Route: `/flashcards`
- Page slug: `flashcards`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-24
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- What user problem this page solves: Rapid recall training with spaced repetition labels (`Know It`, `Still Learning`) and due-date ordering.
- Success criteria (measurable):
  - User starts a deck for selected category/question profile.
  - User rates cards through deck completion.
  - Spaced repetition records update per rated card.
- Non-goals:
  - Certified score tracking.
  - Backend-synced spaced repetition.

## Users and permissions
- Intended roles: `public_user`
- Access denied behavior:
  - If unauthenticated: same behavior
  - If authenticated but forbidden: not applicable
- Controls that must be hidden vs disabled vs visible with error: no role-based control gating.

## Entry points
- From page: header nav -> Flashcards
- Deep link: direct `/flashcards`
- Post-auth redirect: not applicable

## Breadcrumbs
- Breadcrumb trail: none rendered
- Breadcrumb rules (dynamic segments): not applicable
- Sensitive breadcrumb masking rules: not applicable

## Navigation map
- Primary onward paths:
  - setup -> card run -> completion
- Secondary paths:
  - completion -> restart deck
  - completion -> change topic
  - completion -> `/study`
- Exit points:
  - change topic during run
  - header nav

## ASCII wireframe
Desktop (or primary layout):
+------------------------------------------------------+
| Header Nav                                            |
+------------------------------------------------------+
| if loading/error: loader or retry panel              |
+------------------------------------------------------+
| Setup: question pool selector + category selector     |
|        [Start Flashcards]                            |
+------------------------------------------------------+
| Card run: progress + badges                           |
|  question card -> answer card swap (tap/space)       |
|  [Still Learning] [Know It] when flipped             |
|  [Change Topic] [Skip]                               |
+------------------------------------------------------+
| Complete: totals + [Restart Deck] [Change Topic]      |
|           link to Study                               |
+------------------------------------------------------+

Mobile:
+------------------------------+
| Header                       |
+------------------------------+
| Setup selectors stacked      |
| Flip card full width         |
| Rating buttons stacked       |
+------------------------------+

## Components inventory
- `useQuestionBank`
- `useAdaptiveQuestionStats` (filtering + spaced-repetition updates)
- `useLearningEventLogger` (flashcard interaction lifecycle + card-level actions)
- `recordLearningAttempt` pipeline utility for unified flashcard rating writes and telemetry
- `ReferenceModal` for figure references
- Card reveal uses deterministic front/back surface swap (question panel replaced by answer panel) to avoid browser 3D/backface rendering artifacts
- Answer panel displays correct answer text (without fixed source option letter) to avoid reinforcing static letter-position memory
- Rating controls use one-click default confidence (`3/5`) plus split `☑` high-confidence (`5/5`) actions

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `flash.error.retry` | Retry | button | load error and not loaded | always | reload questions | `GET /api/questions?category=All` | loading/error | repeated error panel | none |
| `flash.warning.try_live` | Try Live Source | button | warning banner shown (cached snapshot fallback) | always | force a live-only reload without snapshot fallback | `GET /api/questions?category=All` | refreshes load state and clears warning on success | remains on warning/error if live fetch fails | none |
| `flash.warning.clear_snapshot` | Clear Cached Snapshot | button | warning banner shown (cached snapshot fallback) | always | clear local cached question snapshot so next load must use live source | none | removes `part107_question_bank_snapshot_v1` | if live source remains unavailable, next load may show error instead of fallback warning | none |
| `flash.setup.question_type[*]` | Question Pool option | button | setup | always | set type profile | none | `selectedQuestionType` | none | none |
| `flash.setup.category[*]` | Category option | button | setup | always | set category | none | `selectedCategory` | none | none |
| `flash.setup.start` | Start Flashcards | button | setup | `deckPreview.cards.length > 0` | starts due-first queue (or upcoming fallback) and enter run | none | `sessionCards` initialized, `started=true` | disabled when zero cards | `session_started` |
| `flash.card.flip` | Tap/Space/Enter toggle | button-like card surface | run | always | toggles question/answer surface in either direction | none | `flipped` toggled | none | none |
| `flash.card.show_question` | Show Question | button | run and flipped | always | return to question panel without rating | none | `flipped=false` | none | none |
| `flash.card.figure` | View `<figure>` | button | front card with `figure_reference` | always | open modal | none | `figureRef` | image fallback handled in modal/card | none |
| `flash.card.still_learning` | Still Learning | button | run and flipped | always | commit `still_learning` with default confidence `3/5` and advance queue | none | adaptive stats update with quality-based dequeue/reinsert behavior | none surfaced | `answer_submitted` (`metadata.rating=still_learning`, `metadata.confidence=3`) |
| `flash.card.still_learning_confident` | Still Learning `☑` | split button | run and flipped | always | commit `still_learning` with high confidence `5/5` and advance queue | none | adaptive stats update with stronger quality penalty/reinsertion | none surfaced | `answer_submitted` (`metadata.rating=still_learning`, `metadata.confidence=5`) |
| `flash.card.know_it` | Know It | button | run and flipped | always | commit `know_it` with default confidence `3/5` and advance queue | none | adaptive stats update with quality-based dequeue/reinsert behavior | none surfaced | `answer_submitted` (`metadata.rating=know_it`, `metadata.confidence=3`) |
| `flash.card.know_it_confident` | Know It `☑` | split button | run and flipped | always | commit `know_it` with high confidence `5/5` and advance queue | none | adaptive stats update with strongest dequeue behavior | none surfaced | `answer_submitted` (`metadata.rating=know_it`, `metadata.confidence=5`) |
| `flash.card.change_topic` | Change Topic | button | run | always | return to setup and reset counters | none | `started=false` + restart state | none | none |
| `flash.card.skip` | Skip | button | run | always | move current card to queue tail without rating | none | queue reorder only | none | `question_skipped` |
| `flash.complete.restart` | Restart Deck | button | completion | always | reset counters/index | none | restart state | none | none |
| `flash.complete.change_topic` | Change Topic | button | completion | always | setup + restart | none | started false + reset | none | none |
| `flash.complete.back_study` | Back to Study Mode | link | completion | always | navigate `/study` | none | route change | none | none |
| `flash.modal.close` | Close modal | button/backdrop/key | modal open | always | close modal | none | modal state clear | none | none |

## Page state model
States:
- idle
- loading
- setup
- in_run_unflipped
- in_run_flipped
- complete
- error

State transitions:
- idle -> loading (question load)
- loading -> setup (questions loaded)
- loading -> error (fetch failure)
- error -> loading (Retry)
- setup -> in_run_unflipped (Start Flashcards)
- in_run_unflipped -> in_run_flipped (reveal/toggle action)
- in_run_flipped -> in_run_unflipped (tap/space/enter toggle or Show Question)
- in_run_flipped -> in_run_unflipped (rating submit; quality score decides dequeue vs reinsert gap)
- in_run_* -> complete (session queue becomes empty)
- complete -> in_run_unflipped (Restart)
- complete -> setup (Change Topic)

## Data dependencies
- Required data: question bank
- Optional data: adaptive stats for filtering
- Data sources:
  - API `/api/questions`
  - localStorage keys:
    - `part107_adaptive_stats_v2` (read)
    - `part107_attempt_events_v1` (write via adaptive hook)
    - `part107_learning_events_v1` (write via learning-event logger)
- Session behavior:
  - Setup prefers due-now cards using adaptive `nextDueAt`; when none are due, queue falls back to the soonest 20 cards.
  - During a run, each rating computes a quality score from outcome + confidence:
    - `q>=4`: remove from queue
    - `q=3`: reinsert 5-8 cards later
    - `q=2`: reinsert 2-4 cards later
    - `q<=1`: reinsert 1-2 cards later
- Cache invalidation rules: adaptive stats overwrite per question canonical key on each rating.
- Stale data tolerance: high; adaptive stats are local-only and device-specific.

## API calls and contracts
### Call: Load question bank
- Trigger: mount; retry
- Request: `GET /api/questions?category=All`
- Response: `QuestionApiResponse`
- Pagination: none
- Retry strategy: auto retries with short backoff, then manual retry button
- Timeout: UNKNOWN
- Error mapping to UI: load error panel

## Validation and input rules
- Question-type and category selections constrained to hardcoded options.
- Keyboard shortcuts:
  - Space/Enter flips card when unflipped.
  - ArrowRight or `k` commits `Know It` with default confidence `3/5`.
  - ArrowLeft or `l` commits `Still Learning` with default confidence `3/5`.

## Destructive actions
- Confirmations required: none
- Undo support: none for per-card adaptive spacing updates
- Audit log requirements: none
- Rate limit / abuse protections: not applicable

## Error handling
- Network failure: question load error panel with retry
- 401 unauthenticated: not explicitly handled
- 403 forbidden: not explicitly handled
- 404 not found: framework
- 409 conflict: not applicable
- 422 validation: not surfaced explicitly
- 429 rate limited: generic load error
- 5xx server: generic load error

## Empty states
- True empty: setup with disabled start button when zero cards.
- Filtered empty: category/profile combo can yield zero cards.
- First run empty onboarding: setup copy explains workflow.

## Loading strategy
- Skeleton vs spinner vs placeholder: centered loader text.
- Progressive rendering: none.
- Per-section loading: none.

## Offline and resiliency (if applicable)
- Offline detection: none.
- Read-only fallback: cached question snapshot is used when live fetch fails after retries.
- Queue actions: none.
- Conflict resolution: not applicable.

## Analytics and audit logging
### Analytics events
| Event | Trigger | Properties | Notes |
|------|---------|------------|------|
| `session_started` | Start Flashcards | `mode=flashcards`, `category`, `questionTypeProfile`, `metadata.deckSize`, `metadata.totalPool`, `metadata.dueNowCount`, `metadata.usingUpcomingFallback` | one per run start |
| `question_shown` | New queue-head card shown | `mode=flashcards`, `questionId`, `category`, `subcategory`, `questionTypeProfile` | logged on card transition |
| `answer_submitted` | Rate card (`Know It`/`Still Learning`) | `mode=flashcards`, `questionId`, `isCorrect`, `correctOption`, `metadata.rating`, `metadata.confidence`, `metadata.qualityScore`, `metadata.queueAction`, `metadata.responseTimeMs` | aligns with adaptive write |
| `question_skipped` | Skip current card | `mode=flashcards`, `questionId`, `category`, `subcategory`, `questionTypeProfile` | no adaptive write |
| `session_completed` | Queue drained | `mode=flashcards`, `category`, `questionTypeProfile`, `metadata.initialDeckSize`, `metadata.known`, `metadata.learning`, `metadata.reviews` | one per completion |

### Audit logs (if required)
- What must be recorded: none currently
- Who initiated: UNKNOWN
- Before/after values: adaptive stat updates are not audited

## Accessibility requirements
- Focus order: setup controls -> card -> action buttons.
- Keyboard navigation: explicit keyboard shortcuts for flip/rating.
- Screen reader labels: buttons are text-labeled; reveal surface exposes `role="button"` and keyboard handling for Enter/Space.
- Color contrast constraints: UNKNOWN.
- Error announcement behavior: shared load/error components announce via `aria-live`.

## Performance constraints
- Max items rendered without virtualization: one card view at a time.
- Pagination vs infinite scroll: not applicable.
- Debounce rules: none.
- N+1 call risks: one question-bank fetch.

## Security and abuse cases
- Privilege escalation risks: low.
- IDOR risks: low.
- Injection risks: rendered question text from remote source.
- CSRF/XSS considerations: React text escaping; no HTML injection path observed.
- Data leakage in analytics/logs: adaptive/attempt data + question behavior stored in localStorage plaintext.
- Rate limit or scraping: public API still scrapeable.

## Test plan
- Unit tests: due-deck selection and queue reinsertion/dequeue behavior.
- Integration tests:
  - keyboard shortcuts
  - flip -> reveal -> show-question regression (no blank/mirrored content)
  - rating transitions and counters
  - completion and restart paths
- E2E tests:
  - setup -> run -> complete flow
  - zero-card disabling
- Edge cases worth pinning:
  - localStorage parse corruption recovery
  - figure modal open/close lifecycle

## Observability
- Logs: none structured
- Metrics: none
- Traces: none
- Alerts: none

## Feature flags and rollout
- Flags used: none
- Default behavior when flag off: not applicable

## Open questions (UNKNOWN)
- Should upcoming fallback size be user-configurable?
- Should `Still Learning` reinsertion gap adapt to wrong-streak severity?
- Should skipped cards create an explicit low-priority due timestamp?

## Risks and mitigations
- Risk: adaptive spacing is local-only and easy to lose/alter.
  - Impact: inconsistent study cadence and user frustration across devices.
  - Mitigation: optional account-backed sync with conflict resolution.
- Risk: reveal/swap removes true 3D flip animation.
  - Impact: less visual affordance than an animated flip.
  - Mitigation: prioritize deterministic readability; reintroduce animation only after cross-browser reliability tests pass.

## Future enhancements
- Add import/export or cloud sync for adaptive spacing state.
- Add configurable intervals and difficulty-based spacing.

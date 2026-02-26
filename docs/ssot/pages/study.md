# Page: Study Mode

## Page identity
- Route: `/study`
- Page slug: `study`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-26
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- What user problem this page solves: Guided practice with immediate correctness feedback, explanations, and citation references.
- Success criteria (measurable):
  - User starts a study quiz for chosen category/type.
  - User answers one or more questions and receives inline feedback.
  - Session is persisted to local progress on completion.
- Non-goals:
  - Simulating real exam timing/withheld feedback.
  - Server-side persistence or account sync.

## Users and permissions
- Intended roles: `public_user`
- Access denied behavior:
  - If unauthenticated: Same behavior as authenticated (no auth)
  - If authenticated but forbidden: Not applicable
- Controls that must be hidden vs disabled vs visible with error: No role-based gating implemented.

## Entry points
- From page: header nav -> Study
- From page: `/` hero/topic cards -> `/study?type=<...>` or `/study?category=<...>&type=<...>`
- Deep link:
  - `category` (normalized category)
  - `type` (question type profile)
  - `collection=<all|bookmarks|named-id>` (limit pool to selected collection)
  - `focus=weak` (forces `weak_spots` profile)
- Post-auth redirect: Not applicable

## Breadcrumbs
- Breadcrumb trail: None rendered
- Breadcrumb rules (dynamic segments): Not applicable
- Sensitive breadcrumb masking rules: Not applicable

## Navigation map
- Primary onward paths:
  - Setup -> active quiz
  - Active quiz -> next question -> result
- Secondary paths:
  - Result -> retry current category
  - Result -> reset to setup
  - Result -> `/progress`
  - Citation and figure viewers open modal/new tab
- Exit points: header nav, result links/buttons

## ASCII wireframe
Desktop (or primary layout):
+------------------------------------------------------+
| Header Nav                                            |
+------------------------------------------------------+
| if loading: "Loading question bank..."               |
| if error: error panel + [Retry]                      |
+------------------------------------------------------+
| if setup:                                             |
|  H1 Study Mode                                        |
|  Question Type cards                                  |
|  Category cards [startQuiz(category)]                 |
+------------------------------------------------------+
| if in quiz:                                           |
|  Progress bar + score                                 |
|  Category/Subcategory badges                          |
|  Question card + optional figure button               |
|  Answer option buttons                                |
|  Feedback panel + citations + [Next/See Results]      |
+------------------------------------------------------+
| if complete: summary + [Try Again] [Change Topic]     |
|               + [View Progress Dashboard]             |
+------------------------------------------------------+

Mobile:
+------------------------------+
| Header                       |
+------------------------------+
| Setup controls stacked       |
| Question card full width     |
| Answer buttons stacked       |
| Feedback card + next action  |
+------------------------------+

## Components inventory
- `useQuestionBank` (question fetch, load/error state; includes external `Part107` and `Carrington` source-pack adapters)
- `useStudySession` (study state machine)
- `useAdaptiveQuestionStats` (adaptive scoring and attempt logging)
- `useLearningEventLogger` (interaction telemetry)
- `recordLearningAttempt` pipeline utility (single path for adaptive attempt write + `answer_submitted` telemetry)
- `useProgress` (session persistence)
- `optionPresentation` utility (deterministic per-session option-order randomization with remapped display labels)
- `questionTypePreferenceStore` (per-user default question-type hydration + persistence across Home/Study/Exam)
- `questionCollectionStore` (per-user bookmark + named collection management, collection filter normalization)
- Setup presets for `Session Length` and `Timed Drill` (question-limit + optional timer override per run), persisted per active user in local storage
- In-session confidence selector (1-5) is always visible while unanswered; main answer click submits with selected confidence, and split `☑` on each answer submits high-confidence (`5/5`) in one click
- `QuestionCard`, `AnswerOptions`, `ProgressHeader`, `SessionSummaryCard`, `CitationLinks`, `ReferenceModal`
  - `ReferenceModal` now supports header-only drag, contained body scroll, wheel propagation blocking, image pan/select mode toggle, and image zoom controls (`Zoom +/-`, `Fit Width`)

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `study.error.retry` | Retry | button | question fetch error and not loaded | always | Reload question bank | `GET /api/questions?category=All` | loading/error/loaded updates | shows error panel if repeat failure | none |
| `study.warning.try_live` | Try Live Source | button | warning banner shown (cached snapshot fallback) | always | force a live-only reload without snapshot fallback | `GET /api/questions?category=All` | refreshes load state and clears warning on success | remains on warning/error if live fetch fails | none |
| `study.warning.clear_snapshot` | Clear Cached Snapshot | button | warning banner shown (cached snapshot fallback) | always | clear local cached question snapshot so next load must use live source | none | removes `part107_question_bank_snapshot_v1` | if live source remains unavailable, next load may show error instead of fallback warning | none |
| `study.setup.question_type[*]` | Question Type option | button | setup phase | always | set selected profile | none | `selectedQuestionType` | invalid URL type shows warning banner | none |
| `study.setup.collection_warning` | Invalid collection warning | banner | setup phase with unsupported `collection` query | n/a | informs fallback to all questions | none | none | warning copy only | none |
| `study.setup.collection_badge` | Collection filter active | banner | setup phase when non-`all` collection is selected | n/a | indicates filtered pool + saved count | none | none | empty-state may still occur if selected collection has no matching pool questions | none |
| `study.setup.collection_select` | Active Filter | select | setup phase | always | switch active collection filter (`all`, bookmarks, named collections) | none | `selectedCollectionFilter` | invalid/deleted query id falls back to `all` with warning | none |
| `study.setup.collection_create` | Create Collection | input + button | setup phase | non-empty valid name | create a new named collection and make it active filter | none | `part107_question_collections_v1[:<userId>]`, `selectedCollectionFilter` | invalid/blank name shows notice | none |
| `study.setup.length_preset[*]` | Session Length preset | button | setup phase | always | select per-run question cap preset (`all`, `60`, `40`, `20`, `10`, `5`) | none | `selectedLengthPresetId` | none | none |
| `study.setup.timer_preset[*]` | Timed Drill preset | button | setup phase | always | select per-run timer override (untimed/5m/10m/15m) | none | `selectedTimerPresetId` | none | none |
| `study.setup.category[*]` | Category card | button | setup phase | always | start quiz for category | none | `quizStarted`, `questions`, score reset | zero-question outcome leads to immediate completion UI | none |
| `study.question.bookmark` | Bookmark / Bookmarked | button | quiz in-progress | always | toggle current question in bookmark collection | none | `part107_question_collections_v1[:<userId>]` + local bookmark state | none | none |
| `study.answer.option[*]` | randomized A/B/C/D answer choice | button | quiz in-progress | `answerState == unanswered` | submit selected answer immediately with current selected confidence and reveal feedback | none | `selectedOption`, `answerState`, score, questionResults, `lastRecordedConfidence` | no server error path | `answer_submitted` (`metadata.confidence`) |
| `study.answer.option_confident[*]` | `☑` high-confidence answer | split button | quiz in-progress | `answerState == unanswered` | submit answer immediately with confidence `5/5` and reveal feedback | none | grading + scoring transitions immediately; sets `lastRecordedConfidence=5` | no server error path | `answer_submitted` (`metadata.confidence=5`) |
| `study.answer.confidence[*]` | Confidence 1..5 | button group | quiz in-progress and unanswered | always | set confidence for the next main answer click | none | `answerConfidence` updates | no server error path | none |
| `study.action.skip` | Skip for now | button | quiz in-progress | `answerState == unanswered` | move current unanswered question to end of queue | none | `questions` reorder, index stays on next unseen item | none | none |
| `study.action.save_exit` | Save & Exit / Exit | button | quiz in-progress | always | persist partial results (if any) then return to setup | none | optional `saveSession`, `sessionSaved=true`, `quizStarted=false` | none | none |
| `study.feedback.next` | Next Question / See Results | button | after answer | always | move next or complete | none | index and answer state transitions | none | `question_shown` on next render |
| `study.result.try_again` | Try Again | button | completion | always | restart current category quiz | none | session reset + new question set | none | none |
| `study.result.change_topic` | Change Topic | button | completion | always | return to setup | none | `quizStarted=false` | none | none |
| `study.result.progress` | View Progress Dashboard | link | completion | always | navigate `/progress` | none | route change | none | none |
| `study.question.figure` | Figure preview / open | button | current question has image/figure ref | always | open reference modal | none | `figureRef` set/clear | image load fallback shown in card | none |
| `study.citation.ref[*]` | Citation chip | button | citation parse yields refs | always | open modal or new tab | none | modal open state | external/open failure delegated to browser | `citation_clicked` |
| `study.modal.zoom_in` / `study.modal.zoom_out` / `study.modal.fit_width` | Zoom + / Zoom - / Fit Width | button | modal open for image refs | always | adjust image scale and fit-to-viewport width | none | modal-local zoom state | none | none |
| `study.modal.mode_toggle` | Hand On / Hand Off | button | modal open for image refs | always | switch between pan mode and select mode | none | modal-local interaction mode | none | none |
| `study.modal.close` | Close (X / backdrop / Esc) | button/backdrop/key | modal open | always | close modal | none | modal state reset | none | none |

## Page state model
States:
- idle
- loading
- ready_setup
- ready_quiz_unanswered
- ready_quiz_answered
- complete
- error

State transitions:
- idle -> loading (trigger: initial hook load)
- loading -> ready_setup (conditions: question bank loaded)
- loading -> error (conditions: fetch failure and no cached load)
- error -> loading (trigger: Retry)
- ready_setup -> ready_quiz_unanswered (trigger: `startQuiz`)
- ready_quiz_unanswered -> ready_quiz_unanswered (trigger: set confidence 1..5)
- ready_quiz_unanswered -> ready_quiz_answered (trigger: submit answer via main option click with selected confidence, or split `☑` high-confidence submit)
- ready_quiz_unanswered -> ready_quiz_unanswered (trigger: `skipQuestion`; skipped item moves to tail)
- ready_quiz_answered -> ready_quiz_unanswered (trigger: `nextQuestion`, not last)
- ready_quiz_answered -> complete (trigger: `nextQuestion` on last question)
- ready_quiz_unanswered -> complete (trigger: timed drill reaches zero)
- complete -> ready_quiz_unanswered (trigger: `restartQuiz`)
- ready_quiz_unanswered -> ready_setup (trigger: `Save & Exit` / `Exit`)
- ready_quiz_answered -> ready_setup (trigger: `Save & Exit`)
- complete -> ready_setup (trigger: `resetToSetup`)

## Data dependencies
- Required data:
  - Question bank from `/api/questions`
  - In-memory study session state
- Optional data:
  - Adaptive stats for weighted selection
  - Learning event and attempt stores
  - Per-user preferred question type (default setup profile when no explicit query override)
  - Per-user collections (bookmarks + named) for optional setup filtering and in-session bookmark toggles
- Data sources:
  - API (`useQuestionBank`)
  - localStorage (`part107_adaptive_stats_v2`, `part107_attempt_events_v1`, `part107_learning_events_v1`, `part107_progress`, `part107_study_setup_v1:<userId>`, `part107_default_question_type_v1:<userId>`, `part107_question_collections_v1[:<userId>]`)
- Partial-save behavior:
  - In-progress `Save & Exit` writes answered subset to `part107_progress`.
  - If no answered questions exist, `Exit` returns to setup without persistence.
- Cache invalidation rules:
  - Question fetch uses `cache: no-store`
  - Local stores are append/overwrite per action
- Stale data tolerance: High for local stores; no server reconciliation.

## API calls and contracts
### Call: Load question bank
- Trigger: component mount; manual retry
- Request: `GET /api/questions?category=All`
- Response: `QuestionApiResponse`
- Pagination: none
- Retry strategy: auto retries with short backoff, then manual retry button
- Timeout: UNKNOWN (browser default)
- Error mapping to UI: render error panel with retry button

## Validation and input rules
- `type` query param normalized and restricted to supported list:
  - `confirmed_test`, `all_random`, `part107_bank`, `carrington_bank`, `carrington_strict`, `real_exam`, `weak_spots`
- Unsupported `type` shows warning and falls back to `confirmed_test` (Confirmed Test Questions).
- `collection` query param supports `all`, `bookmarks`, and named collection IDs (unknown IDs show warning + fallback to `all`).
- If `type` is omitted and `focus=weak` is not set, setup hydrates from per-user preferred question type.
- `category` query param normalized via `normalizeCategory`; invalid values fallback to `All` on autostart path.
- Setup presets apply run-scoped settings:
  - Session length presets cap per-run question count (`all`, `60`, `40`, `20`, `10`, `5`).
  - Timed drill presets apply optional countdown override (`untimed`, `5m`, `10m`, `15m`).
  - Preset selections are hydrated and persisted per active user id.
- Option order is shuffled per session and rendered with remapped display labels (`A-D`) while grading still uses underlying source option IDs.
- Study now renders exactly 3 answer choices per question (`1` correct + `2` distractors) when source data contains 4 options; selection is deterministic within a session and randomized between sessions.
- Confidence is captured before reveal via the persistent in-session selector (`1..5`) or split `☑` high-confidence submit (`5/5`), then persisted to adaptive attempt events.
- Input sanitization for question content is done server-side in API route.
- Adaptive canonicalization uses `concept_key` when present so paraphrased equivalents from different sources share mastery history.

## Destructive actions
- Confirmations required: None
- Undo support: None
- Audit log requirements: None
- Rate limit / abuse protections: Not applicable

## Error handling
- Network failure: fetch error panel with `Retry`
- 401 unauthenticated: not explicitly handled
- 403 forbidden: not explicitly handled
- 404 not found: handled by framework routing, not page logic
- 409 conflict: not applicable
- 422 validation: not surfaced explicitly
- 429 rate limited: surfaced as generic fetch failure
- 5xx server: surfaced as generic fetch failure with message

## Empty states
- True empty: Setup still renders category cards with `0 questions available`.
- Filtered empty: Category/profile combinations can show zero counts.
- First run empty onboarding: Not separate; setup itself is first-run state.

## Loading strategy
- Skeleton vs spinner vs placeholder: centered text loader.
- Progressive rendering: no partial render; waits for question bank load.
- Per-section loading: none.

## Offline and resiliency (if applicable)
- Offline detection: None explicit.
- Read-only fallback: cached question snapshot is used when live fetch fails after retries.
- Queue actions: none.
- Conflict resolution: not applicable (local-only writes).

## Analytics and audit logging
### Analytics events
| Event | Trigger | Properties | Notes |
|------|---------|------------|------|
| `question_shown` | active question entered | mode, question identifiers | logged per question render |
| `answer_submitted` | answer selected | selected/correct options, correctness, confidence | logged before scoring side effects complete |
| `review_opened` | feedback panel opens | correctness, identifiers | logged for each answered question |
| `citation_clicked` | citation chip click | citation label/url + question context | includes correct/selected citation source tags |

### Audit logs (if required)
- What must be recorded: None currently (no backend audit system).
- Who initiated: local user only (`local-user`).
- Before/after values: adaptive stats delta is implicit, not explicitly audited.

## Accessibility requirements
- Focus order: DOM sequence in setup and quiz sections.
- Keyboard navigation: native button/link behavior; answer options are buttons.
- Screen reader labels: mostly text-based controls; modal close button has no explicit aria-label (uses visual "X").
- Color contrast constraints: UNKNOWN (not audited).
- Error announcement behavior: shared load/error components announce via `aria-live`; answer feedback panel uses `role="status"` + polite live updates.

## Performance constraints
- Max items rendered without virtualization: all filtered questions may be loaded at once.
- Pagination vs infinite scroll: none.
- Debounce rules: none.
- N+1 call risks: single API call for question bank; no per-question fetches.

## Security and abuse cases
- Privilege escalation risks: low (no auth model).
- IDOR risks: low (no user-scoped API reads).
- Injection risks: question content from remote source could contain malicious text if upstream untrusted.
- CSRF/XSS considerations: rendering is React-escaped; no dangerous HTML injection path observed.
- Data leakage in analytics/logs: events stored plaintext in localStorage; shared browser profiles can expose history.
- Rate limit or scraping: full bank available via public API endpoint.

## Test plan
- Unit tests: keep coverage for answer option behavior and citation parsing.
- Integration tests:
  - load -> setup
  - answer flow and scoring updates
  - completion saves progress once
- E2E tests:
  - query param handling (`category`, `type`, `focus`)
  - retry after API failure
  - modal open/close via click + Escape
- Edge cases worth pinning:
  - zero-question selection
  - invalid question type fallback banner

## Observability
- Logs: Browser console / thrown fetch errors only
- Metrics: None exported
- Traces: None
- Alerts: None

## Feature flags and rollout
- Flags used: None detected
- Default behavior when flag off: Not applicable

## Open questions (UNKNOWN)
- Should study mode block `startQuiz` when selected pool is empty?
- Should learning events be sent to a server sink?
- Should modal interactions include focus trap requirements?

## Risks and mitigations
- Risk: Public question API allows full-bank extraction.
  - Impact: Content scraping and redistribution.
  - Mitigation: Add authenticated tiers, signed asset delivery, and/or rate limits.
- Risk: Local-only persistence is device-scoped and easy to tamper with.
  - Impact: Progress integrity and cross-device inconsistency.
  - Mitigation: Optional account-backed sync with server-side validation.

## Future enhancements
- Add offline cached question-bank fallback.
- Add explicit zero-result guard before quiz start.
- Add richer accessibility semantics for modal and announcements.

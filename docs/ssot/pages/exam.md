# Page: Exam Mode

## Page identity
- Route: `/exam`
- Page slug: `exam`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-24
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- What user problem this page solves: Timed practice exam simulation with deferred feedback and full post-submit review.
- Success criteria (measurable):
  - User starts an exam run with selected category/type.
  - User can answer, navigate, and flag questions.
  - User submits or times out and sees scored review.
  - Review persists session + adaptive updates.
- Non-goals:
  - Proctored/secure testing.
  - Backend grade persistence.

## Users and permissions
- Intended roles: `public_user`
- Access denied behavior:
  - If unauthenticated: same behavior as authenticated
  - If authenticated but forbidden: not applicable
- Controls that must be hidden vs disabled vs visible with error: no role-based gating.

## Entry points
- From page: header nav -> Exam
- From page: `/` hero/topic cards -> `/exam?type=<...>` or `/exam?category=<...>&type=<...>`
- Deep link query params:
  - `category`
  - `type`
- Post-auth redirect: not applicable

## Breadcrumbs
- Breadcrumb trail: none rendered
- Breadcrumb rules (dynamic segments): not applicable
- Sensitive breadcrumb masking rules: not applicable

## Navigation map
- Primary onward paths:
  - setup -> in-progress exam -> review
- Secondary paths:
  - review -> retake exam
  - review -> `/study`
  - review -> `/progress`
- Exit points:
  - header nav links
  - setup link to full exam when category scoped

## ASCII wireframe
Desktop (or primary layout):
+------------------------------------------------------+
| Header Nav                                            |
+------------------------------------------------------+
| if loading/error: loader or retry panel              |
+------------------------------------------------------+
| Setup card: category/type warnings, exam details,    |
| question type selector, [Begin Exam]                 |
+------------------------------------------------------+
| In-progress: timer + progress                         |
| question card + answer options                        |
| [Prev] [Flag] [Navigator] [Next/Submit]              |
| optional navigator grid                               |
+------------------------------------------------------+
| Review: score summary + retake/study/progress links  |
| per-question review list                              |
+------------------------------------------------------+

Mobile:
+------------------------------+
| Header                       |
+------------------------------+
| Setup controls stacked       |
| Exam controls wrap           |
| Navigator grid compressed    |
| Review cards stacked         |
+------------------------------+

## Components inventory
- `useQuestionBank`
- `useExamSession`
- `useAdaptiveQuestionStats`
- `useLearningEventLogger`
- `recordLearningAttempt` pipeline utility (shared answer event payload + optional adaptive write)
- `useProgress`
- `optionPresentation` utility (deterministic per-exam answer-order randomization with display-label remap)
- Confidence-aware answer submission in-session (`default` vs `high confidence`) with review-time adaptive persistence
- `ProgressHeader`, `QuestionCard`, `AnswerOptions`, `SessionSummaryCard`, `CitationLinks`, `ReferenceModal`

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `exam.error.retry` | Retry | button | load error and not loaded | always | reload question bank | `GET /api/questions?category=All` | loading/error state | repeated failure keeps error panel | none |
| `exam.warning.try_live` | Try Live Source | button | warning banner shown (cached snapshot fallback) | always | force a live-only reload without snapshot fallback | `GET /api/questions?category=All` | refreshes load state and clears warning on success | remains on warning/error if live fetch fails | none |
| `exam.warning.clear_snapshot` | Clear Cached Snapshot | button | warning banner shown (cached snapshot fallback) | always | clear local cached question snapshot so next load must use live source | none | removes `part107_question_bank_snapshot_v1` | if live source remains unavailable, next load may show error instead of fallback warning | none |
| `exam.setup.question_type[*]` | Question Type option | button | setup phase | always | set type profile | none | `selectedQuestionType` | invalid query type shows warning | none |
| `exam.setup.begin` | Begin Exam | button | setup phase | `preview.questionCount > 0` | start exam with preview category/type | none | phase -> in-progress, timer start | zero-question disables button | none |
| `exam.setup.full_exam_link` | or take the full practice exam | link | setup with non-All category | always | navigate `/exam` | none | route reset | none | none |
| `exam.inprogress.answer[*]` | randomized answer option | split button | in-progress | always | main click sets answer with default confidence; `☑` sets same answer with high confidence | none | update `answers` map (source id) and `answerConfidenceByQuestionId` | none | `answer_submitted` (`metadata.confidence`) |
| `exam.inprogress.prev` | Prev | button | in-progress | currentIndex > 0 | go previous question | none | current index | none | none |
| `exam.inprogress.flag` | Flag for Review / Flagged | button | in-progress | always | toggle flagged set | none | add/remove current id in `flagged` | none | none |
| `exam.inprogress.navigator_toggle` | Navigator | button | in-progress | always | show/hide question navigator | none | `showNavigator` toggle | none | none |
| `exam.inprogress.next` | Next | button | in-progress and not last question | always | next question | none | current index | none | `question_shown` next render |
| `exam.inprogress.submit` | Submit Exam | button | in-progress and last question | always | submit exam | none | phase -> review | none | `review_opened` on review phase |
| `exam.navigator.item[*]` | question number button | button | navigator visible | always | jump to question and close navigator | none | index change, navigator hide | none | none |
| `exam.review.retake` | Retake Exam | button | review phase | always | restart exam same category/type | none | review -> in-progress | none | none |
| `exam.review.study` | Study Mode | link | review phase | always | navigate `/study` | none | route change | none | none |
| `exam.review.progress` | View Progress Dashboard | link | review phase | always | navigate `/progress` | none | route change | none | none |
| `exam.question.figure` | Figure open | button | figure present | always | open modal | none | `figureRef` | image fallback in question card | none |
| `exam.citation.ref[*]` | Citation chip | button | review rows with citations | always | open modal or new tab | none | modal state | browser/open failures not trapped | `citation_clicked` |
| `exam.modal.close` | Close modal | button/backdrop/key | modal open | always | close modal | none | modal state reset | none | none |

## Page state model
States:
- idle
- loading
- setup
- in_progress
- review
- unavailable
- error

State transitions:
- idle -> loading (initial question-bank request)
- loading -> setup (questions loaded)
- loading -> error (load failure)
- error -> loading (Retry)
- setup -> in_progress (Begin Exam)
- setup -> unavailable (startExam false due zero questions after selection)
- in_progress -> review (Submit Exam or timer reaches zero)
- review -> in_progress (Retake Exam)
- any -> setup (route change/reset path)

## Data dependencies
- Required data:
  - Question bank from API
  - Exam session state (questions, answers, flags, timer)
- Optional data:
  - Adaptive stats for selection
  - Learning event store
- Data sources:
  - API `GET /api/questions`
  - localStorage (`part107_adaptive_stats_v2`, `part107_attempt_events_v1`, `part107_learning_events_v1`, `part107_progress`)
- Cache invalidation rules: API no-store; local writes append/overwrite.
- Stale data tolerance: local-only user telemetry is intentionally eventual and device-scoped.

## API calls and contracts
### Call: Load question bank
- Trigger: mount and retry
- Request: `GET /api/questions?category=All`
- Response: `QuestionApiResponse`
- Pagination: none
- Retry strategy: auto retries with short backoff, then manual retry button
- Timeout: UNKNOWN
- Error mapping to UI: error panel with retry

## Validation and input rules
- `category` query param normalized; invalid shows warning and falls back to full exam setup.
- `type` query param normalized; invalid shows warning and falls back to default supported profile.
- Setup preview computes question count/time before begin.
- Each question's option order is shuffled once per exam session and rendered as local A-D labels to reduce answer-key memorization by letter.
- Confidence is captured per selected answer in-session and forwarded into `recordExamReview` when phase transitions to review.

## Destructive actions
- Confirmations required: none
- Undo support: none
- Audit log requirements: none
- Rate limit / abuse protections: none

## Error handling
- Network failure: load error panel + retry
- 401 unauthenticated: not explicitly handled
- 403 forbidden: not explicitly handled
- 404 not found: framework route handling
- 409 conflict: not applicable
- 422 validation: not surfaced explicitly
- 429 rate limited: generic load error
- 5xx server: generic load error

## Empty states
- True empty: setup can show `questionCount=0` and disabled begin button.
- Filtered empty: per category/type combination may produce zero.
- First run empty onboarding: setup screen doubles as onboarding.

## Loading strategy
- Skeleton vs spinner vs placeholder: text loader.
- Progressive rendering: no; waits for question bank load.
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
| `question_shown` | in-progress question render | mode + question identifiers + type profile | fired for each displayed question |
| `answer_submitted` | answer option click | selected/correct option + correctness + confidence | immediate event per selection |
| `review_opened` | enter review phase | score metadata and exam context | once per exam startTime |
| `citation_clicked` | citation chip click in review | citation metadata + question context | includes type profile |

### Audit logs (if required)
- What must be recorded: none currently
- Who initiated: `local-user`
- Before/after values: not explicitly stored as audit trail

## Accessibility requirements
- Focus order: setup/in-progress/review DOM order.
- Keyboard navigation: native buttons and links; no dedicated hotkeys in exam page.
- Screen reader labels: basic text labels; navigator legend is visual text.
- Color contrast constraints: UNKNOWN.
- Error announcement behavior: load/error states use `aria-live`; low-time warning is surfaced with `role="alert"` and assertive announcement.

## Performance constraints
- Max items rendered without virtualization:
  - Navigator grid renders up to question count (target 60 for full exam).
  - Review list renders all questions post-submit.
- Pagination vs infinite scroll: none.
- Debounce rules: none.
- N+1 call risks: one API fetch at start.

## Security and abuse cases
- Privilege escalation risks: low (no auth).
- IDOR risks: low (no user resource API).
- Injection risks: untrusted remote question source can influence rendered text.
- CSRF/XSS considerations: React escaping mitigates direct HTML injection.
- Data leakage in analytics/logs: localStorage contains full answer history and timing.
- Rate limit or scraping: public question API is scrapeable.

## Test plan
- Unit tests: exam session timer/phase transitions and navigator behavior.
- Integration tests:
  - setup warnings on invalid query params
  - timer expiry -> review transition
  - review persistence to progress/adaptive stores
- E2E tests:
  - full exam happy path
  - flagged + navigator jump flow
  - no-question scenario
- Edge cases worth pinning:
  - submit with unanswered questions
  - repeated retake and event dedupe by `startTime`

## Observability
- Logs: none structured
- Metrics: none exported
- Traces: none
- Alerts: none

## Feature flags and rollout
- Flags used: none
- Default behavior when flag off: not applicable

## Open questions (UNKNOWN)
- Should exam enforce answer confirmation before submission?
- Should timer warnings have accessible audible/live announcements?
- Should question-bank load be cached between study/exam route transitions?

## Risks and mitigations
- Risk: Timer state is client-side and mutable.
  - Impact: score/time integrity cannot be trusted for certification.
  - Mitigation: move timing and scoring to server for high-stakes use.
- Risk: Review renders all explanations immediately.
  - Impact: content scraping at scale becomes easier.
  - Mitigation: gated access controls and content watermarking strategies.

## Future enhancements
- Add optional autosave checkpoints for interrupted exams.
- Add accessibility improvements for timer urgency and navigator grid.
- Add remote progress sync to preserve exam history across devices.

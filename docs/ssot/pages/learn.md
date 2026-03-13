# Page: Learn Mode

## Page identity
- Route: `/learn`
- Page slug: `learn`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-25
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- What user problem this page solves: Teach-first workflow where users read correct answers/explanations before quiz reinforcement on the same batch.
- Success criteria (measurable):
  - User completes teach phase for selected batch.
  - User completes quiz phase queue and reaches result summary.
  - Result screen reports both first-pass accuracy and eventual mastery.
  - User can re-learn missed items, skip for later, save and exit, then resume.
- Non-goals:
  - Timed exam simulation.

## Users and permissions
- Intended roles: `public_user`
- Access denied behavior:
  - If unauthenticated: same behavior
  - If authenticated but forbidden: not applicable
- Controls that must be hidden vs disabled vs visible with error: no role-based gating.

## Entry points
- From page: header nav -> Learn
- Deep link: direct `/learn`
- Post-auth redirect: not applicable

## Breadcrumbs
- Breadcrumb trail: none rendered
- Breadcrumb rules (dynamic segments): not applicable
- Sensitive breadcrumb masking rules: not applicable

## Navigation map
- Primary onward paths:
  - setup -> teach -> quiz -> result
- Secondary paths:
  - result -> re-learn missed
  - result -> next round
  - result -> save and exit
  - result -> setup (discard saved draft)
- Exit points: header nav route changes

## ASCII wireframe
Desktop (or primary layout):
+------------------------------------------------------+
| Header Nav                                            |
+------------------------------------------------------+
| if loading/error: loader or retry panel              |
+------------------------------------------------------+
| Setup: batch-size chips, question-pool selector,      |
| category selector, [Start Learning]                  |
+------------------------------------------------------+
| Teach phase: progress + question + highlighted answer |
| explanations + [Prev/Next or Now Quiz Me]            |
+------------------------------------------------------+
| Quiz phase: queue-based question + immediate feedback |
| [Skip] [Save & Exit] [Next/Still Learning/Results]   |
+------------------------------------------------------+
| Result: score summary + [Re-learn Missed] [Next Round]|
|         [Save & Exit] [Back to Setup]                |
+------------------------------------------------------+

Mobile:
+------------------------------+
| Header                       |
+------------------------------+
| Setup controls stacked       |
| Teach and quiz cards stacked |
| Result buttons stacked/wrap  |
+------------------------------+

## Components inventory
- `useQuestionBank` (includes external `Part107 Question Bank` source-pack adapter)
- `useAdaptiveQuestionStats` (filtering + graded learn quiz attempts)
- `useLearningEventLogger` (learn lifecycle and question-level interaction events)
- `recordLearningAttempt` pipeline utility for quiz answer commits (adaptive attempt + `answer_submitted`)
- `useProgress` (persist first-pass question outcomes)
- `learnDraftStore` (`part107_learn_draft_v1`) for save/resume
- `questionTypePreferenceStore` for per-user default question-pool hydration/persistence
- Local state machine: `phase` (`setup|teach|quiz|result`)
- Utility: in-file `shuffleArray`, queue reinsertion helper, learn result summarizer
- `optionPresentation` utility (deterministic per-round option-order randomization with display-label remap)
- Quiz confidence selector (`1..5`) is visible before answer reveal and applied immediately when an answer is selected

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `learn.error.retry` | Retry | button | fetch error and not loaded | always | reload questions | `GET /api/questions?category=All` | load/error state | repeated failure keeps error panel | none |
| `learn.warning.try_live` | Try Live Source | button | warning banner shown (cached snapshot fallback) | always | force a live-only reload without snapshot fallback | `GET /api/questions?category=All` | refreshes load state and clears warning on success | remains on warning/error if live fetch fails | none |
| `learn.warning.clear_snapshot` | Clear Cached Snapshot | button | warning banner shown (cached snapshot fallback) | always | clear local cached question snapshot so next load must use live source | none | removes `part107_question_bank_snapshot_v1` | if live source remains unavailable, next load may show error instead of fallback warning | none |
| `learn.setup.batch_size[*]` | 3/5/10/15/20 | button | setup | always | set batch size | none | `batchSize` | none | none |
| `learn.setup.question_type[*]` | Question Pool option | button | setup | always | set question type | none | `selectedQuestionType` | none | none |
| `learn.setup.category[*]` | Category option | button | setup | always | set category | none | `selectedCategory` | none | none |
| `learn.setup.resume` | Resume Session | button | setup and saved draft exists | always | restore saved round state | none | setup values + session phase/indices restored | invalid draft is discarded | `session_resumed` |
| `learn.setup.discard_saved` | Discard Saved Session | button | setup and saved draft exists | always | clear saved draft | none | draft removed | none | none |
| `learn.setup.start` | Start Learning | button | setup | `categoryQuestions.length > 0` | start round 1 | none | batch, phase->teach, round reset | disabled when zero questions | `session_started` |
| `learn.teach.prev` | Previous | button | teach and not first item | always | decrement teach index | none | `teachIndex` | none | none |
| `learn.teach.next` | Next | button | teach and not last item | always | increment teach index | none | `teachIndex` | none | none |
| `learn.teach.skip` | Skip for now | button | teach | `batch.length > 1` | move current teach item to end | none | `batch` reorder, `teachIndex` adjusted | no-op when single-item batch | `question_skipped` (`metadata.phase=teach`) |
| `learn.teach.save_exit` | Save & Exit | button | teach | always | save draft and return setup | none | draft persisted, phase->setup | none | `session_saved` |
| `learn.teach.start_quiz` | Now Quiz Me on These | button | teach at last item | always | enter quiz phase | none | phase->quiz, quiz order shuffle | none | none |
| `learn.quiz.answer[*]` | randomized answer option | button | quiz | `showResult == false` | commit selected answer with current confidence and reveal feedback | none | `selectedAnswer`, `selectedConfidence`, `quizResults`, adaptive + attempt-event update, `showResult=true` | none | `answer_submitted` (`metadata.confidence`, `metadata.qualityScore`) |
| `learn.quiz.confidence[*]` | Confidence 1..5 | button group | quiz and not revealed | always | set confidence used by next answer click | none | `answerConfidence` updates | none | none |
| `learn.quiz.skip` | Skip for now | button | quiz | `showResult == false` and `quizOrder.length > 1` and no pending selected answer | move current quiz item to queue tail | none | `quizOrder` reorder (head->tail) | no-op when single-item order | `question_skipped` (`metadata.phase=quiz`) |
| `learn.quiz.save_exit` | Save & Exit | button | quiz | always | save partial progress + draft, return setup | none | progress may persist answered subset; phase->setup | none | `session_saved` |
| `learn.quiz.next` | Next Question / Still Learning — Review Again / See Results | button | quiz after answer | always | commit outcome to queue | none | correct => dequeue head; incorrect => reinsert head 2-5 positions later; phase->result when queue empties; result summary recalculated | none | `review_opened` precedes this action after answer |
| `learn.result.relearn` | Re-learn Missed | button | result and not all-mastered | always | rebuild batch from latest unmastered set and return teach | none | phase->teach, batch replaced | none | none |
| `learn.result.next_round` | Next Round | button | result | `round * batchSize < categoryQuestions.length` | start next round | none | round++, phase->teach | disabled at end | none |
| `learn.result.save_exit` | Save & Exit | button | result | always | save progress/draft and return setup | none | phase->setup | none | `session_saved` |
| `learn.result.back_setup` | Back to Setup | button | result | always | discard draft and reset setup state | none | phase->setup and draft clear | none | none |

## Page state model
States:
- idle
- loading
- setup
- teach
- quiz
- result
- error

State transitions:
- idle -> loading (initial question load)
- loading -> setup (questions loaded)
- loading -> error (fetch failure)
- error -> loading (Retry)
- setup -> teach (`startRound`)
- teach -> quiz (`startQuizPhase` initializes shuffled queue)
- teach -> teach (`skipTeachQuestion`)
- teach -> setup (`Save & Exit`)
- quiz -> quiz (`skipQuizQuestion`, head moved to tail)
- quiz -> quiz (confidence selection update while unanswered)
- quiz -> quiz (answer committed; quality score decides dequeue vs reinsertion gap)
- quiz -> result (quality decision dequeues final queue item)
- quiz -> setup (`Save & Exit`)
- result -> teach (re-learn missed or next round)
- result -> setup (`Save & Exit` or Back to Setup)

## Data dependencies
- Required data: question bank
- Optional data: adaptive stats for `filterQuestionsByType`; per-user preferred question type
- Data sources:
  - API `/api/questions`
  - localStorage adaptive stats (read/write)
  - localStorage attempt events (write via adaptive hook)
  - localStorage learning events (write via learning-event logger)
  - localStorage preferred question type: `part107_default_question_type_v1[:<userId>]`
- localStorage learn draft:
  - `part107_learn_draft_v1` (save/resume state for `teach|quiz|result`)
- localStorage progress:
  - `part107_progress` receives first-pass deduped learn-quiz subsets
- Quiz session behavior:
  - Quiz consumes `quizOrder` as a queue (`quizOrder[0]` current item).
  - Quiz answer quality (`q`) from outcome+confidence drives queue action:
    - `q>=4`: dequeue
    - `q=3`: reinsert 5-8 later
    - `q=2`: reinsert 2-4 later
    - `q<=1`: reinsert 1-2 later
- Cache invalidation rules: API no-store fetch.
- Stale data tolerance: local adaptive stats may be stale; learn draft can become stale if question IDs disappear.

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
- Question-type options constrained to hardcoded profile list.
  - includes `part107_bank`, `carrington_bank`, and `carrington_strict` for source-pack-only learn rounds
- Batch size constrained to fixed set `[3,5,10,15,20]`.
- Category constrained to `All` + `STUDY_CATEGORIES` values.
- Teach and quiz options are rendered in deterministic shuffled order per round with local display labels (`A-C`) while correctness logic uses source option IDs.
- Teach and quiz render exactly 3 visible answer choices per question (`1` correct + `2` distractors) when source data contains 4 options; selection is deterministic within a round and randomized between rounds/sessions.
- Quiz confidence selector is always visible during unanswered quiz state; selected value (`1..5`) is applied on answer click and persisted with the attempt.
- Adaptive canonicalization uses `concept_key` when present so paraphrased equivalents from different sources share mastery history.

## Destructive actions
- Confirmations required: none
- Undo support: partial (`Back to Setup` and re-learn missed)
- Audit log requirements: none
- Rate limit / abuse protections: not applicable

## Error handling
- Network failure: error panel + retry
- 401 unauthenticated: not explicitly handled
- 403 forbidden: not explicitly handled
- 404 not found: framework route handling
- 409 conflict: not applicable
- 422 validation: not surfaced explicitly
- 429 rate limited: generic load error
- 5xx server: generic load error

## Empty states
- True empty: setup start button disabled when pool has zero items.
- Filtered empty: category/type combos can produce zero available questions.
- First run empty onboarding: setup copy provides workflow explanation.

## Loading strategy
- Skeleton vs spinner vs placeholder: centered text loader.
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
| `session_started` | Start round | `mode=learn`, `category`, `questionTypeProfile`, `metadata.round`, batch sizes/counts | one per started round |
| `session_resumed` | Resume saved draft | `mode=learn`, category/profile, restored phase/round/queue size | one per resume action |
| `session_saved` | Save & Exit | `mode=learn`, category/profile, phase/round/attempt metadata | emitted in teach/quiz/result |
| `question_shown` | Teach or quiz question becomes active | `mode=learn`, `questionId`, `category`, `subcategory`, `metadata.phase` | emitted on each transition |
| `answer_submitted` | Quiz answer selected | `mode=learn`, selected/correct option, correctness, `metadata.responseTimeMs` | aligned with adaptive + attempt updates |
| `review_opened` | Quiz feedback panel shown after answer | `mode=learn`, `questionId`, correctness, `metadata.phase=quiz` | immediate post-answer visibility |
| `question_skipped` | Skip in teach/quiz | `mode=learn`, `questionId`, `metadata.phase`, queue/round metadata | no grading update |
| `session_completed` | Enter result phase | `mode=learn`, first-pass/mastery totals in metadata | one per completed round |

### Audit logs (if required)
- What must be recorded: none currently
- Who initiated: UNKNOWN
- Before/after values: adaptive + attempt event records are not audited

## Accessibility requirements
- Focus order: setup controls -> content -> navigation buttons.
- Keyboard navigation: native button behavior only.
- Screen reader labels: text labels present for controls.
- Color contrast constraints: UNKNOWN.
- Error announcement behavior: load/error states use `aria-live`; quiz feedback panel uses `role="status"` + polite live updates.

## Performance constraints
- Max items rendered without virtualization: batch-sized teach/quiz rendering; no large list views.
- Pagination vs infinite scroll: none.
- Debounce rules: none.
- N+1 call risks: single question-bank fetch.

## Security and abuse cases
- Privilege escalation risks: low (no auth).
- IDOR risks: low.
- Injection risks: remote question text if external source configured.
- CSRF/XSS considerations: React escaping for text nodes.
- Data leakage in analytics/logs: attempt/adaptive telemetry + question content stored client-side.
- Rate limit or scraping: full bank remains fetchable via API.

## Test plan
- Unit tests: phase transitions and quiz result calculations.
- Integration tests:
  - re-learn missed batch generation
  - next-round disabling when exhausted
  - saved draft resume/discard + save-and-exit return-to-setup behavior
- E2E tests:
  - end-to-end setup -> teach -> quiz -> result flow
  - zero-pool disabled start
- Edge cases worth pinning:
  - randomization and round offset behavior
  - empty next batch path (no-op)

## Observability
- Logs: none structured
- Metrics: none
- Traces: none
- Alerts: none

## Feature flags and rollout
- Flags used: none
- Default behavior when flag off: not applicable

## Open questions (UNKNOWN)
- Should progress dashboards surface both first-pass and eventual-mastery metrics for learn sessions?
- Should resume draft auto-expire after inactivity window?

## Risks and mitigations
- Risk: Learn save/resume draft can become invalid after content changes.
  - Impact: users lose resume ability and may lose expected context.
  - Mitigation: validate IDs on resume and present explicit recovery messaging.
- Risk: Partial-progress persistence can create many small sessions.
  - Impact: noisier progress history and weaker trend quality.
  - Mitigation: session tagging for learn mode and optional merge heuristics.
- Risk: Round slicing + queue reinsertion can skew effort toward hard items and increase round duration.
  - Impact: uneven curriculum exposure.
  - Mitigation: cap reinsertion loops and expose per-round max-attempt guardrail.

## Future enhancements
- Add explicit completion state when no more rounds remain.
- Add first-pass vs mastery trend charts in `/progress`.

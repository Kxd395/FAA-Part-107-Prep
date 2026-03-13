# Page: Flashcards

## Page identity
- Route: `/flashcards`
- Page slug: `flashcards`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-03-13
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

## Study mode strategy
Flashcards on web should support more than one study behavior. The browser gives us keyboard input, wider layout, and better pointer precision than mobile, so the page should be treated as a flashcard workspace rather than a single flip-card toy.

### Mode taxonomy
| Mode | What the learner does | Best for | Web fit | Status |
|------|------------------------|----------|---------|--------|
| `recognition_flip` | Read prompt, flip, self-rate recall quality | fast spaced repetition | very strong | `implemented` |
| `confidence_rating` | rate `Still Learning` / `Know It` with normal or high confidence | scheduling and retention | very strong | `implemented` |
| `rapid_keyboard_review` | drive a whole deck from keyboard only (`Space`, `Enter`, arrows, `k`, `l`) | desktop power users | very strong | `implemented` |
| `figure_reference_review` | open chart/figure while staying in the run | map/chart questions | strong | `implemented` |
| `multiple_choice_flashcard` | answer a 3-choice MCQ before reveal, then continue after feedback/explanation | FAA-style recognition and answer-position resilience | very strong | `implemented` |
| `strict_recall` | think of the answer before reveal; no visible options before commit | real memory retrieval | strong | `target_v2` |
| `typed_answer` | type the answer before reveal, with typo-tolerant validation | acronyms, abbreviations, weather codes, rule references | very strong | `target_v2` |
| `reverse_card` | study both prompt -> answer and answer -> prompt | acronyms, definitions, regulations | strong | `target_v2` |
| `cloze_card` | fill in a hidden phrase or value inside a sentence | limits, definitions, rules | strong | `later` |
| `image_occlusion` | click or reveal hidden labels on a figure | sectional/chart memorization | strong | `later` |
| `matching_drill` | drag or match terms to meanings | grouped concept review | medium | `later` |
| `cheat_sheet_preview` | scan the full deck in list form before testing | cram/review before session | medium | `later` |

### Web-first control model
- `Space` / `Enter`: flip card or reveal answer
- `ArrowLeft` / `l`: rate `Still Learning`
- `ArrowRight` / `k`: rate `Know It`
- `A-C` / `1-3`: answer the visible choice in `multiple_choice_flashcard`
- `Enter` / `Space` on revealed MCQ result: continue to the next scheduling step
- `1..5`: reserve for direct confidence selection when explicit confidence chips are visible
- `f`: open figure/reference when present
- `b`: reserve for bookmark/save-to-collection when that flow lands

### Delivery split
- `Now`
  - Keep flip/reveal, confidence-based rating, skip, figure modal, scheduler-driven queueing, keyboard-first review, and the new 3-choice drill mode fast and stable.
- `Next`
  - Add `strict_recall` as a no-options-until-reveal mode.
  - Add `typed_answer` and `reverse_card` for acronym/abbreviation and regulation-reference decks.
- `Later`
  - Add richer content-specific drills such as cloze, image occlusion, matching, and cheat-sheet/list preview.

### Design rules for future modes
- Do not fragment scheduling: all flashcard modes should write into the same adaptive/spaced-repetition history unless explicitly marked as non-scoring preview.
- Do not force pointer-only interaction: every mode added to web must remain keyboard-usable.
- Do not overfit to answer-letter memory: when options exist, preserve the strict 3-choice randomized presentation contract already used across web study flows.
- Prefer mode switches at setup, not mid-card, so analytics and queue behavior stay coherent.
- Typed/strict modes should be used selectively for content that actually benefits from recall pressure; not every Part 107 question should become a free-response exercise.

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
- `useQuestionBank` (includes external `Part107` and `Carrington` source-pack adapters)
- `useAdaptiveQuestionStats` (filtering + spaced-repetition updates)
- `useLearningEventLogger` (flashcard interaction lifecycle + card-level actions)
- `recordLearningAttempt` pipeline utility for unified flashcard rating writes and telemetry
- `ReferenceModal` for figure references
- `QuestionIssueReporter` for one-line question/answer issue reports
- `questionTypePreferenceStore` for per-user default question-pool hydration/persistence
- Card reveal uses deterministic front/back surface swap (question panel replaced by answer panel) to avoid browser 3D/backface rendering artifacts
- Answer panel displays correct answer text (without fixed source option letter) to avoid reinforcing static letter-position memory
- Rating controls expose a triad confidence selector (`Not Sure=1`, `Neutral=3`, `Confident=5`) across both card faces (pre-reveal and revealed)
- Setup includes scheduler settings with persisted user defaults (`dailyReviewTarget`, `maxNewCardsPerDay`, `lapseHandling`)

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `flash.error.retry` | Retry | button | load error and not loaded | always | reload questions | `GET /api/questions?category=All` | loading/error | repeated error panel | none |
| `flash.warning.try_live` | Try Live Source | button | warning banner shown (cached snapshot fallback) | always | force a live-only reload without snapshot fallback | `GET /api/questions?category=All` | refreshes load state and clears warning on success | remains on warning/error if live fetch fails | none |
| `flash.warning.clear_snapshot` | Clear Cached Snapshot | button | warning banner shown (cached snapshot fallback) | always | clear local cached question snapshot so next load must use live source | none | removes `part107_question_bank_snapshot_v1` | if live source remains unavailable, next load may show error instead of fallback warning | none |
| `flash.setup.run_mode[*]` | Study Style option | button | setup | always | switch between `flip` and `mcq` flashcard runs | none | `selectedRunMode` | none | none |
| `flash.setup.question_type[*]` | Question Pool option | button | setup | always | set type profile | none | `selectedQuestionType` | none | none |
| `flash.setup.category[*]` | Category option | button | setup | always | set category | none | `selectedCategory` | none | none |
| `flash.setup.daily_target[*]` | Daily Review Target | button | setup | always | set per-session deck cap for due/upcoming cards | none | `dailyReviewTarget` | none | none |
| `flash.setup.max_new[*]` | Max New Cards / Day | button | setup | always | cap number of new cards surfaced for the current day | none | `maxNewCardsPerDay` | none | none |
| `flash.setup.lapse_handling[*]` | Lapse Handling | button | setup | always | choose reinsertion aggressiveness for misses (`balanced/aggressive/gentle`) | none | `lapseHandling` | none | none |
| `flash.setup.start` | Start Flashcards | button | setup | `deckPreview.cards.length > 0` | starts due-first queue (or upcoming fallback) and enter run | none | `sessionCards` initialized, `started=true` | disabled when zero cards | `session_started` |
| `flash.card.flip` | Tap/Space/Enter toggle | button-like card surface | run and `runMode=flip` | always | toggles question/answer surface in either direction | none | `flipped` toggled | none | none |
| `flash.card.show_question` | Show Question | button | run and flipped | always | return to question panel without rating | none | `flipped=false` | none | none |
| `flash.card.figure` | View `<figure>` | button | front card with `figure_reference` or `image_ref` | always | resolve image URL (`image_ref` first, else `/figures/<figure_reference>.png`) and open modal | none | `figureRef` | modal shows load failure message when source is unavailable | none |
| `flash.card.mcq.answer[*]` | Answer option `A-C` | button | run, `runMode=mcq`, unanswered | always | submit selected answer with default confidence `3/5` and reveal feedback panel | none | `mcqSelectedOption`, `mcqConfidence`, `mcqAnswerState`, `flipped=true` | none surfaced | none |
| `flash.card.mcq.answer_confidence[*]` | Answer `NS/N/C` | button | run, `runMode=mcq`, unanswered | always | submit selected answer with quick confidence (`1/3/5`) and reveal feedback panel | none | `mcqSelectedOption`, `mcqConfidence`, `mcqAnswerState`, `flipped=true` | none surfaced | none |
| `flash.card.mcq.continue` | Continue | button | run, `runMode=mcq`, flipped | answer submitted | persist adaptive attempt and advance queue according to correctness + confidence | none | queue reorder/dequeue + adaptive update | none surfaced | `answer_submitted` |
| `flash.card.confidence[*]` | Confidence `NS/N/C` | button group | run | always | set confidence used by next main rating click (`1/3/5`) | none | `ratingConfidence` updates | none surfaced | none |
| `flash.card.still_learning` | Still Learning | button | run and flipped | always | commit `still_learning` with selected confidence and advance queue | none | adaptive stats update with quality-based dequeue/reinsert behavior | none surfaced | `answer_submitted` (`metadata.rating=still_learning`, `metadata.confidence`) |
| `flash.card.know_it` | Know It | button | run and flipped | always | commit `know_it` with selected confidence and advance queue | none | adaptive stats update with quality-based dequeue/reinsert behavior | none surfaced | `answer_submitted` (`metadata.rating=know_it`, `metadata.confidence`) |
| `flash.card.issue.toggle` | Report issue | button | run | always | show/hide one-line issue input for current card | none | local reporter panel open/close state | none surfaced | none |
| `flash.card.issue.submit` | Send | button | run and issue panel open | one-line note present | submit issue report for current card/question metadata | `POST /api/user/question-issues` | none | inline submit error text | none |
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
- in_run_unflipped -> in_run_unflipped (confidence selection update)
- in_run_unflipped -> in_run_flipped (reveal/toggle action)
- in_run_unflipped -> in_run_flipped (`runMode=mcq` answer submission with stored correctness/confidence)
- in_run_flipped -> in_run_unflipped (tap/space/enter toggle or Show Question)
- in_run_flipped -> in_run_unflipped (rating submit or MCQ continue; quality score decides dequeue vs reinsert gap)
- in_run_* -> complete (session queue becomes empty)
- complete -> in_run_unflipped (Restart)
- complete -> setup (Change Topic)

## Data dependencies
- Required data: question bank
- Optional data: adaptive stats for filtering; per-user preferred question type
- Data sources:
  - API `/api/questions`
  - localStorage keys:
    - `part107_adaptive_stats_v2` (read)
    - `part107_attempt_events_v1` (write via adaptive hook)
    - `part107_learning_events_v1` (write via learning-event logger)
    - `part107_default_question_type_v1[:<userId>]` (read/write preferred question pool)
    - `part107_flashcard_scheduler_settings_v1[:<userId>]` (read/write scheduler defaults)
    - `part107_flashcard_scheduler_daily_v1[:<userId>]` (read/write daily new-card seen quota state)
- Session behavior:
  - Setup prefers due-now cards using adaptive `nextDueAt`; when none are due, queue falls back to the soonest 20 cards.
  - Daily target limits the run deck size; max-new-per-day limits how many unseen cards can appear in a day.
  - During a run, each rating computes a quality score from outcome + confidence:
    - `q>=4`: remove from queue
    - `q=3`: reinsert 5-8 cards later
    - `q=2`: reinsert 2-4 cards later
    - `q<=1`: reinsert 1-2 cards later
  - Lapse handling modifies miss reinsertion:
    - `balanced`: keep default reinsertion gaps
    - `aggressive`: force misses to reappear in 1-2 cards
    - `gentle`: push misses +2 cards farther than default
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
- Question-pool options include `confirmed_test`, `all_random`, `part107_bank`, `carrington_bank`, `carrington_strict`, and `real_exam`.
- Scheduler settings are constrained to setup presets:
  - daily target: `10/20/30/50`
  - max new/day: `0/5/10/20`
  - lapse handling: `balanced/aggressive/gentle`
- `multiple_choice_flashcard` presents exactly 3 visible choices (`1` correct + `2` distractors) when source data has 4 options, with deterministic per-session randomization and local `A-C` display-label remapping while correctness continues to use source option IDs.
- Keyboard shortcuts:
  - In `flip` mode, Space/Enter flips card when unflipped.
  - In `flip` mode, ArrowRight or `k` commits `Know It` with currently selected confidence.
  - In `flip` mode, ArrowLeft or `l` commits `Still Learning` with currently selected confidence.
  - In `mcq` mode, `A-C` or `1-3` submit the visible choice with default confidence `3/5`.
  - In `mcq` mode, Enter/Space on the feedback panel continues to the next queue step.
- Adaptive canonicalization uses `concept_key` when present so paraphrased equivalents from different sources share mastery history.

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

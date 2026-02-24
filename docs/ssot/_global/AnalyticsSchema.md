# Analytics Schema

## Principles
- Primary telemetry storage is local (`localStorage` key `part107_learning_events_v1`) scoped by `userId`.
- Optional remote sink forwarding is feature-flagged:
  - `NEXT_PUBLIC_ANALYTICS_SINK_ENABLED=true`
  - `NEXT_PUBLIC_ANALYTICS_SINK_URL=<https endpoint>`
  - `NEXT_PUBLIC_ANALYTICS_SINK_TOKEN=<optional bearer token>`
- Sink forwarding is best-effort and non-blocking; local writes remain source of truth when sink fails.
- Sink transport retries with short backoff (`250ms`, `500ms`), then dead-letters failed payloads to local storage (`part107_analytics_sink_deadletter_v1`) for later flush attempts.
- Dead-letter entries carry retry metadata (`retryCount`, `lastError`, `nextRetryAt`) and are retried with exponential backoff (base `5s`, capped `10m`).
- Sink payload metadata is allowlisted to reduce accidental sensitive-data exfiltration.
- Event writes are runtime-validated against mode/type taxonomy and scalar metadata constraints before persistence.

## Event definitions

### Event: `page_view`
- Trigger: route mount on instrumented pages (`/`, `/charts`, `/missed`, `/progress`).
- Properties:
  - `mode` (`home|charts|missed|progress`)
  - `metadata.route`

### Event: `control_clicked`
- Trigger: explicit control actions (for example progress export/import/reset/sync controls).
- Properties:
  - `mode`
  - `metadata.action`
  - optional context fields (`download`, reset `scope`, telemetry export counts, etc.)

### Event: `filter_changed`
- Trigger: selection/search/filter updates.
- Properties:
  - `mode`
  - `metadata.filter`
  - optional fields (`value`, `selectedMode`, `selectedType`, `timeWindow`, `searchLength`, `hasQuery`)

### Event: `tab_changed`
- Trigger: tab switches (progress dashboard tabs).
- Properties:
  - `mode=progress`
  - `metadata.tab`

### Event: `link_opened`
- Trigger: user opens internal/external links tracked for funnel/navigation visibility, including global header nav links.
- Properties:
  - `mode`
  - `metadata.target`, `metadata.href`
  - optional link context (for example `metadata.figure`, `metadata.sourcePath`)

### Event: `import_previewed`
- Trigger: valid progress snapshot selected for import.
- Properties:
  - `mode=progress`
  - `metadata.selectedMergeMode`
  - `metadata.previewKeys`

### Event: `import_applied`
- Trigger: user confirms apply import on progress page.
- Properties:
  - `mode=progress`
  - `metadata.selectedMergeMode`
  - `metadata.changedKeys`

### Event: `question_shown`
- Trigger:
  - Study: when a new question becomes active after quiz start
  - Exam: when in-progress question is rendered
  - Learn: when teach/quiz phase shows a question
  - Flashcards: when a card becomes queue head
- Properties:
  - `mode` (`study|exam|learn|flashcards`)
  - `questionId`, `category`, `subcategory`
  - `questionTypeProfile`
  - optional `metadata` (`phase`, queue indices/counts)

### Event: `answer_submitted`
- Trigger:
  - user selects an option in study/exam/learn quiz flows
  - user rates a flashcard (`Know It`/`Still Learning`)
- Properties:
  - `mode`, `questionId`, `category`, `subcategory`
  - `selectedOption`, `correctOption`, `isCorrect`
  - `questionTypeProfile`
  - optional `metadata` (`responseTimeMs`, flashcard rating, queue size)

### Event: `question_skipped`
- Trigger:
  - Learn: skip in teach or quiz phase
  - Flashcards: skip current card (head -> tail)
- Properties:
  - `mode`, `questionId`, `category`, `subcategory`
  - `questionTypeProfile`
  - optional `metadata` (`phase`, `round`, queue size)

### Event: `review_opened`
- Trigger:
  - Study: after answer feedback panel becomes visible
  - Exam: when review phase is first entered for a run
  - Learn: quiz feedback panel shown after answer submit
- Properties:
  - `mode`, `questionId` (study)
  - `category`, `subcategory`
  - `isCorrect` (study/learn)
  - `metadata.scorePercent`, `metadata.correctCount`, `metadata.totalQuestions` (exam)

### Event: `citation_clicked`
- Trigger: user clicks a parsed citation reference chip or tracked FAA reference link.
- Properties:
  - `mode`, `questionId`, `category`, `subcategory`
  - `citationLabel`, `citationUrl`
  - `questionTypeProfile` (exam)

### Event: `session_started`
- Trigger:
  - Learn: start round
  - Flashcards: start deck
- Properties:
  - `mode`, `category`, `questionTypeProfile`
  - `metadata` (round/deck sizing and queue context)

### Event: `session_saved`
- Trigger:
  - Learn: Save & Exit
- Properties:
  - `mode`, `category`, `questionTypeProfile`
  - `metadata` (`phase`, `round`, queue/attempt counts)

### Event: `session_resumed`
- Trigger:
  - Learn: Resume Session from saved draft
- Properties:
  - `mode`, `category`, `questionTypeProfile`
  - `metadata` (restored phase/round/queue size)

### Event: `session_completed`
- Trigger:
  - Learn: transition to result phase
  - Flashcards: queue drained
- Properties:
  - `mode`, `category`, `questionTypeProfile`
  - `metadata` (first-pass/mastery counts for learn; rating totals for flashcards)

## Attempt-event schema (parallel telemetry)
Per-graded-answer events are also stored under `part107_attempt_events_v1` with:
- `attemptId`, `questionKey`, `questionId`, `timestamp`, `mode`, `correct`
- `selectedOptionId`, `responseTimeMs`, `quizId`
- `topicTags`, `difficulty`, `confidence`
- Current `mode` values in attempt store: `pretest|practice|flashcard|quiz|mock`

## Sampling rules
- No sampling implemented; all events are logged until per-store retention cap.

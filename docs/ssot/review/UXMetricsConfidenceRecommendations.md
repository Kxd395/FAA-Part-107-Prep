# UX, Metrics, and Confidence Recommendations

Generated: 2026-02-26

## What changed now
- Local runtime question source is canonical-only (`112` raw), with unresolved figure dependencies gated out at load (`105` active questions).
- Setup pages use compact question-pool selector (Study, Exam, Learn, Flashcards).
- Confidence controls now support a simple 3-state model in active sessions:
  - Not Sure (`1`)
  - Neutral (`3`)
  - Confident (`5`)
- Confidence capture is now mode-consistent for answer-based flows:
  - Study/Exam/Learn-quiz use one-touch per-answer confidence actions (`NS`, `N`, `C` = `1/3/5`).
  - The duplicate in-session top confidence selector was removed from Study/Exam/Learn quiz views.
  - Main answer-tap fallback remains neutral (`3/5`) when users skip quick confidence taps.
  - Flashcards retains a pre-rating confidence selector (shared by `Know It` / `Still Learning`).
- Exam now clarifies grading behavior:
  - Users can change answers before submit.
  - Only final answer is graded.
- Exam answer telemetry is de-skewed:
  - `answer_submitted` logs only on first submission per question.
  - Final grading still uses end-of-exam answer map.
  - Additional `control_clicked` telemetry now records `answer_changed` interactions before submit.
- Backend ML/scoring collection is now wired:
  - New authenticated ingestion route: `POST /api/user/learning-events`.
  - New scoring summary route: `GET /api/user/scoring/summary?window=24h|7d|30d|all`.
  - Sink defaults to first-party ingestion (`/api/user/learning-events`) when enabled.
  - Sink retries only server/throttle failures and no longer treats HTTP 4xx as successful telemetry.
- Question collections are now included in backend persistence/sync/export:
  - `part107_question_collections_v1` added to user-state tracked keys.
  - `part107_question_collections_v1` added to sync merge keys.
  - Progress portable import/export now includes collections.
- In-question quality feedback loop is now live:
  - Study/Exam/Learn/Flashcards/Missed each include an inline `Report issue` action with one-line note input.
  - Payload auto-attaches question stem/options/correct key/current selection/confidence and posts to `POST /api/user/question-issues`.
- Broken figure placeholders no longer surface as faux content:
  - Canonical local loader drops unresolved figure rows when no local/remote figure asset is resolvable and figure text is placeholder-only.
  - Question card suppresses unresolved placeholder text and shows a neutral unavailable message instead.

## Performance/setup tightening (next)
1. Keep only core setup controls visible by default.
- Keep: Question Pool, Category, Session Length, Timer.
- Collapse: Collections/Templates into “Advanced”.

2. Reduce option entropy.
- Prefer 3-4 preset buttons per section (not 5+ where possible).
- Move legacy modes to an explicit “Legacy” group.

3. Normalize defaults by mode.
- Study: `Confirmed Test`, `All`, `Untimed`, confidence `Neutral`.
- Exam: `Real Exam`, `All`, `60Q`, `120 min`, confidence `Neutral`.
- Flashcards: `Confirmed Test`, `All Categories`, conservative new-card cap.

## Metrics quality guardrails
1. Distinguish first answer vs final answer metrics.
- Keep `first_submission` and `final_submission` separately for analysis.

2. Track answer-change rate.
- Add `answer_changed_before_submit` counter per session/question.
- Use it to detect confusion-heavy prompts.

3. Track confidence calibration.
- Compare confidence bucket (`1/3/5`) vs correctness over time.
- Surface simple calibration insight on Progress page.

4. Keep remote/local source visibility in UI.
- Continue showing source label next to question count.
- Helps explain sudden pool-size differences (e.g., 112 vs 280).

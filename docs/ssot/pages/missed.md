# Page: Missed Questions

## Page identity
- Route: `/missed`
- Page slug: `missed`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-26
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- What user problem this page solves: Consolidated remediation view of historically incorrect questions with explanations and references.
- Success criteria (measurable):
  - User can identify repeatedly missed questions.
  - User can filter by category and sort by count/recentness.
  - User can expand entries and review correct vs selected answers.
- Non-goals:
  - Grading new attempts.
  - Editing question content.

## Users and permissions
- Intended roles: `public_user`
- Access denied behavior:
  - If unauthenticated: same behavior
  - If authenticated but forbidden: not applicable
- Controls that must be hidden vs disabled vs visible with error: no role-based gating.

## Entry points
- From page: header nav -> Missed
- From page: home feature card
- Deep link: direct `/missed`
- Post-auth redirect: not applicable

## Breadcrumbs
- Breadcrumb trail: none rendered
- Breadcrumb rules (dynamic segments): not applicable
- Sensitive breadcrumb masking rules: not applicable

## Navigation map
- Primary onward paths:
  - list overview -> expand question details
- Secondary paths:
  - empty state -> `/study` or `/exam`
  - figure modal open/close
- Exit points: header nav links

## ASCII wireframe
Desktop (or primary layout):
+------------------------------------------------------+
| Header Nav                                            |
+------------------------------------------------------+
| if loading/error: loader or retry panel              |
| if empty: no missed state + [Start Studying] [Exam]  |
+------------------------------------------------------+
| Header + controls: [Most Missed] [Most Recent]       |
| Category chips (All + categories with counts)        |
+------------------------------------------------------+
| Missed question cards (collapsible)                  |
|  collapsed: badges + question text                   |
|  expanded: your answer, correct answer, options,     |
|            explanation, citation, figure link        |
+------------------------------------------------------+

Mobile:
+------------------------------+
| Header                       |
+------------------------------+
| Sort chips + category chips  |
| Collapsible cards stacked    |
| Figure modal overlay         |
+------------------------------+

## Components inventory
- `useQuestionBank`
- `useProgress`
- Local derived data maps (`missMap`, `categoryCounts`)
- `questionCollectionStore` (bulk add/remove visible missed questions to bookmarks or named collections)
- `optionPresentation` utility (stable display-label remap so review letters match rendered option order)
- `ReferenceModal`
- `QuestionIssueReporter` (inline one-line issue submit per expanded question)

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `missed.error.retry` | Retry | button | question load error | always | reload question bank | `GET /api/questions?category=All` | loading/error | repeat failure keeps error panel | none |
| `missed.warning.try_live` | Try Live Source | button | warning banner shown (cached snapshot fallback) | always | force a live-only reload without snapshot fallback | `GET /api/questions?category=All` | refreshes load state and clears warning on success | remains on warning/error if live fetch fails | none |
| `missed.warning.clear_snapshot` | Clear Cached Snapshot | button | warning banner shown (cached snapshot fallback) | always | clear local cached question snapshot so next load must use live source | none | removes `part107_question_bank_snapshot_v1` | if live source remains unavailable, next load may show error instead of fallback warning | none |
| `missed.empty.study` | Start Studying | link | no missed entries | always | navigate `/study` | none | route change | none | `link_opened` |
| `missed.empty.exam` | Take Exam | link | no missed entries | always | navigate `/exam` | none | route change | none | `link_opened` |
| `missed.sort.count` | Most Missed | button | non-empty state | always | sort by miss count desc | none | `sortBy=count` | none | `filter_changed` |
| `missed.sort.recent` | Most Recent | button | non-empty state | always | sort by latest miss timestamp | none | `sortBy=recent` | none | `filter_changed` |
| `missed.collection.select` | Collection selector | select | non-empty state | always | choose destination collection (`bookmarks` or named) for bulk actions | none | `selectedCollectionId` | none | none |
| `missed.collection.add_visible` | Add Visible | button | non-empty state | always | add currently filtered missed question IDs into selected collection | none | collection store write + notice text | none | `control_clicked` |
| `missed.collection.remove_visible` | Remove Visible | button | non-empty state | always | remove currently filtered missed question IDs from selected collection | none | collection store write + notice text | none | `control_clicked` |
| `missed.collection.create` | Create Collection | input + button | non-empty state | non-empty valid name | create named collection and select it | none | collection store write + notice text | invalid/blank name notice | none |
| `missed.filter.category[*]` | Category chip | button | non-empty state | always | filter entries by category | none | `selectedCategory` | none | `filter_changed` |
| `missed.entry.toggle[*]` | Expand/collapse row | button | non-empty list | always | expand selected question details | none | `expandedId` | none | `control_clicked` |
| `missed.list.load_more` | Load More | button | filtered list larger than visible page | always | reveal next page of missed entries | none | `visibleCount += 20` | none | none |
| `missed.entry.figure` | View figure | button | expanded row with `figure_reference` or `image_ref` | always | resolve image URL (`image_ref` first, else `/figures/<figure_reference>.png`) and open reference modal | none | `figureRef` | modal load-failure UI on missing assets | `citation_clicked` |
| `missed.entry.issue.toggle` | Report issue | button | expanded row | always | show/hide one-line issue input for current question | none | local reporter panel open/close state | none surfaced | none |
| `missed.entry.issue.submit` | Send | button | expanded row and reporter open | one-line note present | submit issue report for selected missed question | `POST /api/user/question-issues` | none | inline submit error text | none |
| `missed.modal.close` | Close modal | button/backdrop/key | modal open | always | close modal | none | modal state clear | none | none |

## Page state model
States:
- idle
- loading
- ready_empty
- ready_list
- error
- paged_list

State transitions:
- idle -> loading (questions + progress load)
- loading -> ready_empty (loaded and no misses)
- loading -> ready_list (loaded and misses exist)
- loading -> error (question bank failure)
- error -> loading (Retry)
- ready_list -> ready_list (sort/filter/expand actions)
- ready_list -> paged_list (load-more when additional results exist)
- paged_list -> paged_list (subsequent load-more)

## Data dependencies
- Required data:
  - Question bank (for metadata and explanations)
  - Progress sessions (for incorrect answer history)
- Optional data: none
- Data sources:
  - API `/api/questions`
  - localStorage `part107_progress`, `part107_question_collections_v1[:<userId>]`
- Cache invalidation rules: computed map recalculated when sessions/questions change.
- Stale data tolerance: high; local progress can be manually modified.

## API calls and contracts
### Call: Load question bank
- Trigger: mount; retry
- Request: `GET /api/questions?category=All`
- Response: `QuestionApiResponse`
- Pagination: none
- Retry strategy: auto retries with short backoff, then manual retry button
- Timeout: UNKNOWN
- Error mapping to UI: retry panel

## Validation and input rules
- `sortBy` constrained to `count` or `recent`.
- Category filter values constrained to known `STUDY_CATEGORIES` plus `All`.
- Missing question IDs in progress history are skipped silently during join.

## Destructive actions
- Confirmations required: none
- Undo support: not applicable (read-only view)
- Audit log requirements: none
- Rate limit / abuse protections: not applicable

## Error handling
- Network failure: question-load error panel + retry
- 401 unauthenticated: not explicitly handled
- 403 forbidden: not explicitly handled
- 404 not found: framework
- 409 conflict: not applicable
- 422 validation: not surfaced
- 429 rate limited: generic load failure
- 5xx server: generic load failure

## Empty states
- True empty: "No Missed Questions Yet" panel with study/exam links.
- Filtered empty: "No missed questions in this category" message when filter yields none.
- First run empty onboarding: empty panel doubles as first-run instruction.

## Loading strategy
- Skeleton vs spinner vs placeholder: centered loader text.
- Progressive rendering: waits for both question and progress stores.
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
| `page_view` | missed mount | `route=/missed` | local + optional sink |
| `filter_changed` | sort/category filter controls | `filter`, `value`, optional `category` | tracks remediation browsing behavior |
| `control_clicked` | expand/collapse question row | `action=toggle_missed_entry`, `entryId`, `expanded` | interaction depth signal |
| `citation_clicked` | figure link click from expanded entry | `citationLabel`, `citationUrl`, `questionId` | source-reference behavior |
| `link_opened` | empty-state CTAs | `target`, `href` | outbound start/retry funnel |

### Audit logs (if required)
- What must be recorded: none currently
- Who initiated: UNKNOWN
- Before/after values: not applicable (read-only)

## Accessibility requirements
- Focus order: sort controls -> category chips -> entry toggles -> expanded content actions.
- Keyboard navigation: all controls are buttons/links.
- Screen reader labels: text-based labels available; expand toggles now expose `aria-expanded` and `aria-controls`.
- Reference modal behavior: focus is trapped while open and restored to prior trigger on close.
- Color contrast constraints: UNKNOWN.
- Error announcement behavior: shared load/error components announce via `aria-live`.

## Performance constraints
- Max items rendered without virtualization: list renders first 20 and loads additional 20-item pages on demand.
- Pagination vs infinite scroll: manual load-more pagination with virtualized fallback when filtered list exceeds 300 rows.
- Debounce rules: none.
- N+1 call risks: none (single fetch + local joins).

## Security and abuse cases
- Privilege escalation risks: low.
- IDOR risks: low.
- Injection risks: rendered question text from content source.
- CSRF/XSS considerations: React escapes text; no HTML injection path.
- Data leakage in analytics/logs: progress and wrong answers stored plaintext in localStorage.
- Rate limit or scraping: relies on public API source.

## Test plan
- Unit tests: miss aggregation and sorting logic.
- Integration tests:
  - join behavior when progress references unknown question IDs
  - expanded row rendering with distractor explanation
- E2E tests:
  - empty state path
  - sorting/filtering behavior
  - load-more pagination behavior
- Edge cases worth pinning:
  - timestamp ordering ties
  - very large session history rendering

## Observability
- Logs: none structured
- Metrics: none
- Traces: none
- Alerts: none

## Feature flags and rollout
- Flags used: none
- Default behavior when flag off: not applicable

## Open questions (UNKNOWN)
- Should missed list include only exam misses, or both study+exam (current behavior: both)?
- Should users be able to clear individual missed entries?
- Should expanded rows include direct "retry this question" action?

## Risks and mitigations
- Risk: Missing IDs in progress history silently disappear from view.
  - Impact: users lose visibility into some historical misses.
  - Mitigation: surface warning counts for orphaned question IDs.
- Risk: local progress tampering can distort remediation priorities.
  - Impact: weak-spot guidance becomes unreliable.
  - Mitigation: signed or server-verified progress store.

## Future enhancements
- Add targeted retry actions from missed cards.
- Add search and jump-to-category for very large missed sets.

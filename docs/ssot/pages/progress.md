# Page: Progress Dashboard

## Page identity
- Route: `/progress`
- Page slug: `progress`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-25
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- What user problem this page solves: Visibility into accuracy trends, weak spots, session history, and local telemetry/debug signals.
- Success criteria (measurable):
  - User can inspect aggregate performance and per-session details.
  - User can inspect response-time telemetry QA baselines (P50/P95, null/zero anomaly rates).
  - User can inspect telemetry activity with filters (mode/type/window/search).
  - User can export/import local progress payloads safely with preview + merge mode.
  - User can export a redacted telemetry support bundle.
  - User can reset only selected data scopes instead of forcing full wipe.
- Non-goals:
  - Server-backed analytics dashboards.
  - Multi-user collaboration.

## Users and permissions
- Intended roles: `public_user`
- Access denied behavior:
  - If unauthenticated: same behavior
  - If authenticated but forbidden: not applicable
- Controls that must be hidden vs disabled vs visible with error: no role-gated controls.

## Entry points
- From page: header nav -> Progress
- From page: study/exam completion links
- Deep link: direct `/progress`
- Post-auth redirect: not applicable

## Breadcrumbs
- Breadcrumb trail: none rendered
- Breadcrumb rules (dynamic segments): not applicable
- Sensitive breadcrumb masking rules: not applicable

## Navigation map
- Primary onward paths:
  - tab switch (`Overview`, `History`, `Categories`)
  - history row expand/collapse
- Secondary paths:
  - empty state -> `/study` or `/exam`
  - weak-spots CTA -> `/study`
- Exit points:
  - reset local data
  - export local data
  - import local data (preview -> apply/cancel)

## ASCII wireframe
Desktop:
+------------------------------------------------------+
| Header Nav                                            |
+------------------------------------------------------+
| if loading: loader                                    |
| if no sessions: empty state + [Start Studying] [Exam]|
+------------------------------------------------------+
| Header + [Export] [Import] [Reset Data]              |
| Import Preview: [Merge/Overwrite] [Apply] [Cancel]   |
| Stat cards + Tab bar                                  |
+------------------------------------------------------+
| Overview: adaptive insights                           |
|          telemetry filters + recent events            |
|          learn first-pass vs mastery trend            |
|          accuracy trend + weak spots                  |
| History: collapsible sessions                         |
| Categories: per-category accuracy bars                |
+------------------------------------------------------+

Mobile:
+------------------------------+
| Header                       |
+------------------------------+
| Controls stacked             |
| Stat cards stacked           |
| Tabs full width              |
| Collapsible session rows     |
+------------------------------+

## Components inventory
- `useProgress` (sessions + stats + clear)
- `defaultAdaptiveStatsStore`, `defaultAttemptEventStore`, `defaultLearningEventStore`
- `computeAdaptiveInsights`
  - includes confidence-derived metrics from objective attempts: average confidence, calibration score (Brier-based), and overconfidence rate
- `computeResponseTimeTelemetry` (response-time percentile + null/zero anomaly diagnostics by mode)
- `computeLearningEventInsights`, `computeLearnCompletionTrend` (in-file helpers)
- `computeImportPreview`, `resolveImportedData` (`progressImportMerge.ts`)
- Local UI state:
  - `showConfirmClear`, `activeTab`
  - reset flow: `resetScope` (`all|progress|adaptive|telemetry`)
  - import flow: `transferError`, `pendingImportSnapshot`, `pendingImportFileName`, `importMergeMode`
  - telemetry filter controls: mode/type/window/search (Overview tab)
  - history pagination: `visibleCount` (load-more paging)
  - history virtualization fallback: `virtualStartIndex` windowing for large datasets

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `progress.empty.study` | Start Studying | link | no sessions | always | navigate `/study` | none | route change | none | `link_opened` |
| `progress.empty.exam` | Take an Exam | link | no sessions | always | navigate `/exam` | none | route change | none | `link_opened` |
| `progress.transfer.export` | Export Data | button | sessions exist and not confirming | always | download snapshot JSON | none | none | browser download failures | `control_clicked` |
| `progress.account.user` | Account User | input | sessions exist | always | set auth user-id input value | none | `authUserInput` | none | none |
| `progress.account.sign_in` | Sign In | button | sessions exist | always | create/refresh app auth cookie session and trigger automatic account-state fetch/import preview | `POST /api/auth/session`, `GET /api/user/state` | `authenticatedUserId`, `authStatus`, account import preview state | auth/validation/rate-limit errors shown inline | `control_clicked` |
| `progress.account.sign_out` | Sign Out | button | sessions exist | always | clear app auth cookie session | `DELETE /api/auth/session` | `authenticatedUserId` cleared, account statuses reset | errors shown inline | `control_clicked` |
| `progress.account.save` | Save Account State | button | sessions exist | authenticated | push tracked local keys to authenticated account record | `PUT /api/user/state` | `cloudStatus`, `cloudUpdatedAt` | auth/rate-limit/validation errors shown inline | `control_clicked` |
| `progress.account.load` | Load Account State | button | sessions exist | authenticated | load tracked keys from account into import preview | `GET /api/user/state` | `pendingImportSnapshot`, `cloudStatus`, `cloudUpdatedAt` | `404` shown as "No account state found yet" | `control_clicked` |
| `progress.sync.user` | Sync User | input | sessions exist | always | set sync identity used for API calls | none | `syncUserId` | none | none |
| `progress.sync.upload` | Upload to Sync | button | sessions exist | always | ensure sync session token, upload snapshot, and auto-refresh token once on `401` before final failure | `POST /api/sync/session`, `POST /api/sync/upload` | `syncToken`, `syncStatus`, `syncUpdatedAt` | auth/rate-limit/validation errors surfaced in sync status | `control_clicked` |
| `progress.sync.download` | Download from Sync | button | sessions exist | always | ensure sync session token, download snapshot, and auto-refresh token once on `401` before final failure | `POST /api/sync/session`, `GET /api/sync/download` | `syncToken`, `pendingImportSnapshot`, `syncStatus`, `syncUpdatedAt` | `404` shown as "no snapshot", other failures shown in sync status | `control_clicked` |
| `progress.deadletter.retry` | Retry Queue | button | sessions exist | dead-letter queue has entries and `nextRetryAt` is due | retry sink dead-letter queue flush | optional sink POST attempts | dead-letter summary refresh | sink still failing keeps queue entries | none |
| `progress.deadletter.clear` | Clear Queue | button | sessions exist | always | clear sink dead-letter queue | none | dead-letter summary reset | none | none |
| `progress.telemetry.export` | Export Telemetry | button | sessions exist and not confirming | always | download redacted telemetry support bundle | none | none | browser download failures | `control_clicked` |
| `progress.transfer.import` | Import Data | button/file picker | sessions exist and not confirming | always | select JSON snapshot | none | populate pending import preview state | invalid snapshot => banner | `control_clicked`, `import_previewed` |
| `progress.transfer.mode.merge` | Merge (Recommended) | button | pending import preview | always | set merge mode | none | `importMergeMode=merge` | none | `filter_changed` |
| `progress.transfer.mode.overwrite` | Overwrite | button | pending import preview | always | set merge mode | none | `importMergeMode=overwrite` | none | `filter_changed` |
| `progress.transfer.conflict.keep_remote[*]` | Keep Remote | button | pending import preview + key will change | always | set per-key conflict winner to incoming snapshot value | none | `conflictResolutionByKey[key]=remote`; updates conflict summary counts | none | none |
| `progress.transfer.conflict.keep_local[*]` | Keep Local | button | pending import preview + key will change | always | set per-key conflict winner to current local value | none | `conflictResolutionByKey[key]=local`; updates conflict summary counts | none | none |
| `progress.transfer.apply` | Apply Import | button | pending import preview | always | resolve + write keys + reload | none | local keys replaced/merged; preview cleared | write/parse path errors surfaced as banner before apply | `import_applied` |
| `progress.transfer.cancel` | Cancel | button | pending import preview | always | close import preview | none | clears pending import state | none | none |
| `progress.reset.trigger` | Reset Data | button | sessions exist and not confirming | always | show confirm controls | none | `showConfirmClear=true` | none | `control_clicked` |
| `progress.reset.scope[*]` | Reset scope selector | button-group | confirm state | always | select scope | none | `resetScope` | none | `filter_changed` |
| `progress.reset.confirm` | Yes, Reset `<scope>` | button | confirm state | always | clear selected scope stores | none | selected stores cleared; confirm off | no explicit failure UI | `control_clicked` |
| `progress.reset.cancel` | Cancel | button | confirm state | always | hide confirmation | none | `showConfirmClear=false` | none | `control_clicked` |
| `progress.tab.*` | Overview/History/Categories | button | sessions exist | always | switch tab | none | `activeTab` | none | `tab_changed` |
| `progress.telemetry.mode` | Mode filter | select | overview + telemetry present | always | filter event list by mode | none | `selectedMode` | none | `filter_changed` |
| `progress.telemetry.type` | Type filter | select | overview + telemetry present | always | filter event list by type | none | `selectedType` | none | `filter_changed` |
| `progress.telemetry.window` | Window filter | select | overview + telemetry present | always | filter by time window | none | `timeWindow` | none | `filter_changed` |
| `progress.telemetry.search` | Search events | input | overview + telemetry present | always | text filter | none | `searchQuery` | none | `filter_changed` |
| `progress.overview.weakspots.cta` | Drill Weak Spots | link | weak spots present | always | navigate `/study` | none | route change | none | none |
| `progress.history.row[*]` | Session row expand/collapse | button | history tab | always | toggle detailed view | none | `expandedId` | none | none |
| `progress.history.load_more` | Load More | button | history tab and hidden rows remain | always | reveal next page of sessions | none | `visibleCount += 15` | none | none |

## Page state model
States:
- idle
- loading
- ready_empty
- ready_overview
- ready_history
- ready_categories
- reset_confirm_open
- import_preview_open
- import_error

State transitions:
- idle -> loading (local stores/hook hydration)
- loading -> ready_empty (no sessions)
- loading -> ready_overview (sessions exist)
- ready_overview <-> ready_history <-> ready_categories (tab switch)
- ready_* -> reset_confirm_open (reset trigger)
- reset_confirm_open -> ready_* (cancel)
- reset_confirm_open -> ready_* (apply scope reset)
- ready_* -> import_preview_open (valid import selected)
- ready_* -> import_preview_open (valid import selected from file or sync download)
- import_preview_open -> ready_* (cancel)
- import_preview_open -> loading (apply import + reload)
- ready_* -> import_error (invalid snapshot parse/version)
- ready_* -> ready_empty (reset all)

## Data dependencies
- Required data:
  - `part107_progress`
- Optional data:
  - `part107_adaptive_stats_v2`
  - `part107_attempt_events_v1`
  - `part107_learning_events_v1`
  - `part107_flashcard_sr` (legacy compat)
  - `part107_learn_draft_v1`
- Data sources:
  - localStorage (primary source for UI state and merge preview)
  - account state API (`/api/auth/session`, `/api/user/state`) for authenticated per-user persistence
  - optional sync API (`/api/sync/session`, `/api/sync/upload`, `/api/sync/download`) for cross-device transfer
- Cache invalidation rules: values recomputed on render/reload.
- Stale data tolerance: high for local reads; sync status/updatedAt can be stale between manual uploads/downloads.

## API calls and contracts
- `POST /api/sync/session` from both sync controls before upload/download attempts.
- `POST /api/sync/upload` from `Upload to Sync` control.
- `GET /api/sync/download?userId=<syncUserId>` from `Download from Sync` control.
- Sync calls retry once with refreshed session token after `401` responses.
- Import/apply itself remains local-only after snapshot is loaded.

## Validation and input rules
- Active tab constrained to `overview|history|categories`.
- Import payload must match `{ version: 1, data: Record<string, string | null> }`.
- Merge mode values constrained to `merge|overwrite`.
- Telemetry filters constrained to known analytics taxonomy values + `all`.
- Confidence metrics exclude flashcard attempts because flashcards are self-rated and not objectively graded.
- Response-time QA panel computes P50/P95 plus null/zero anomaly checks (overall + by mode) from `part107_attempt_events_v1`.

## Destructive actions
- Confirmations required: yes (two-step reset + explicit scope selection).
- Undo support: none.
- Audit log requirements: none.
- Rate limit / abuse protections: not applicable.
- Data overwrite action:
  - Overwrite import mode replaces tracked keys.
  - Merge import mode applies per-store merge rules and dedupe.
  - Scoped reset applies only selected local storage domains.

## Error handling
- Network failure: sync calls surface inline status string.
- 401 unauthenticated: sync status shows session/header auth failure details.
- 403 forbidden: sync status shows user mismatch details.
- 404 not found: framework route handling
- 409 conflict: not applicable
- 422 validation: not used by current progress/sync routes.
- 429 rate limited: sync session/upload/download failures surfaced via sync status.
- 5xx server: sync status surfaces server error strings.
- Import failure: parse/version mismatch produces `Import failed:` banner

## Empty states
- True empty: "No Progress Yet" panel with study/exam CTAs.
- Filtered empty: categories tab can show "Answer some questions first".
- Telemetry filtered empty: "No events matched the selected filters".

## Loading strategy
- Skeleton vs spinner vs placeholder: centered text loader.
- Progressive rendering: none.
- Per-section loading: none.

## Offline and resiliency (if applicable)
- Offline detection: none.
- Read-only fallback: fully local; works offline after bundle load.
- Queue actions: telemetry sink dead-letter queue can be retried/cleared from this page.
- Conflict resolution: merge mode supports deterministic per-key winner selection with local-vs-remote summary counts in preview.

## Analytics and audit logging
### Analytics events
| Event | Trigger | Properties | Notes |
|------|---------|------------|------|
| `page_view` | progress mount | `route=/progress` | local + optional sink |
| `control_clicked` | export/import/reset controls | `action`, optional flags (`scope`, telemetry counts, etc.) | local + optional sink |
| `tab_changed` | tab switch | `tab` | local + optional sink |
| `filter_changed` | import mode + telemetry filters | `filter` + selected value context | local + optional sink |
| `import_previewed` | valid import parsed | `selectedMergeMode`, `previewKeys` | local + optional sink |
| `import_applied` | import applied | `selectedMergeMode`, `changedKeys` | local + optional sink |
| `link_opened` | empty-state links | `target`, `href` | local + optional sink |

### Audit logs (if required)
- What must be recorded: none currently.
- Who initiated: local user.
- Before/after values: not persisted as audit records.

## Accessibility requirements
- Focus order: header controls -> tabs -> tab content.
- Keyboard navigation: native button/link/input/select controls.
- Screen reader labels: textual labels present for telemetry filters and reset-scope controls.
- History rows expose `aria-expanded` and `aria-controls` for expanded detail sections.
- Color contrast constraints: UNKNOWN.
- Error announcement behavior: banner is visible; no aria-live region yet.

## Performance constraints
- Max items rendered without virtualization: history tab paginates in 15-session chunks; telemetry recent list capped to 12 visible rows.
- Pagination vs infinite scroll: manual load-more pagination for history, with virtualized fallback when total sessions exceed 250.
- Debounce rules: none.
- N+1 call risks: none (local computations only).

## Security and abuse cases
- Privilege escalation risks: low.
- IDOR risks: low.
- Injection risks: user-controlled import payload could inject malformed JSON (guarded by parser/shape checks, but values still user supplied).
- CSRF/XSS considerations: local-only actions.
- Data leakage in analytics/logs: local event payload includes learning behavior; sink metadata is allowlisted but still sensitive.
- Rate limit or scraping: not applicable.

## Test plan
- Unit tests:
  - `computeProgressStats`, `computeAdaptiveInsights`
  - `progressImportMerge` merge/overwrite/preview behavior
- Integration tests:
  - scoped reset flows clear only intended stores
  - import preview + apply with merge/overwrite
  - telemetry filters reduce event list correctly
  - telemetry support export generates redacted payload
  - virtualized history fallback activates for large session collections
  - sync download opens import preview from remote payload
  - dead-letter queue controls update pending count
- E2E tests:
  - empty -> populated transition
  - import invalid snapshot banner
  - import merge preserves newer records
- Edge cases worth pinning:
  - malformed localStorage payload recovery
  - very large history/event retention rendering

## Observability
- Logs: none structured in-app
- Metrics: derived dashboard counts only
- Traces: none
- Alerts: none

## Feature flags and rollout
- Flags used:
  - analytics sink forwarding flags (`NEXT_PUBLIC_ANALYTICS_SINK_*`)
- Default behavior when flag off:
  - telemetry remains local-only in `part107_learning_events_v1`.

## Open questions (UNKNOWN)
- Should import offer dry-run diff details per key before apply?
- Should support-bundle export include optional hashed question keys for deeper diagnostics, or stay fully redacted?

## Risks and mitigations
- Risk: import overwrite can replace valid local data with stale/incorrect snapshot.
  - Impact: misleading stats and lost recent progress.
  - Mitigation: preview + merge mode + changed-key counts before apply.
- Risk: local data tampering can alter displayed performance.
  - Impact: unreliable self-assessment.
  - Mitigation: signed records or server sync for trusted stats.

## Future enhancements
- Add per-session delete and annotation actions.
- Add per-key diff preview details before import apply.
- Add cloud sync + device conflict UX.

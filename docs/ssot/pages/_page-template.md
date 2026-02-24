# Page: UNKNOWN

## Page identity
- Route: UNKNOWN
- Page slug: UNKNOWN
- Owner (eng): <eng-owner-handle>
- Owner (product): <product-owner-handle>
- Owner (design): <design-owner-handle>
- Last updated: <YYYY-MM-DD>
- Related tickets/PRs: <ticket-or-pr-link>

## Purpose
- What user problem this page solves: UNKNOWN
- Success criteria (measurable): UNKNOWN
- Non-goals: UNKNOWN

## Users and permissions
- Intended roles: UNKNOWN
- Access denied behavior:
  - If unauthenticated: UNKNOWN
  - If authenticated but forbidden: UNKNOWN
- Controls that must be hidden vs disabled vs visible with error: UNKNOWN

## Entry points
List every way the user can land here.
- From page: UNKNOWN, action: UNKNOWN
- Deep link: UNKNOWN
- Post-auth redirect: UNKNOWN

## Breadcrumbs
- Breadcrumb trail: UNKNOWN
- Breadcrumb rules (dynamic segments): UNKNOWN
- Sensitive breadcrumb masking rules: UNKNOWN

## Navigation map
Where can the user go from here, and why.
- Primary onward paths: UNKNOWN
- Secondary paths: UNKNOWN
- Exit points (logout, cancel, close): UNKNOWN

## ASCII wireframe
Desktop (or primary layout):
+------------------------------------------------------+
| TopNav: [AppName]   [GlobalSearch?]    [UserMenu]    |
+------------------------------------------------------+
| Breadcrumbs: Home > UNKNOWN                           |
+-------------------------+----------------------------+
| LeftNav (optional)      | Main Content               |
| - Item                  | [H1: UNKNOWN]              |
| - Item                  |                            |
|                         | [Filters/Inputs]           |
|                         |                            |
|                         | [Primary CTA] [Secondary]  |
|                         |                            |
|                         | [Table/List/Cards]         |
|                         |                            |
+-------------------------+----------------------------+
| Footer / status (optional)                           |
+------------------------------------------------------+

Mobile:
+------------------------------+
| [Back]  UNKNOWN      [Menu]  |
+------------------------------+
| Home > UNKNOWN (truncate)    |
+------------------------------+
| [H1]                         |
| [Controls stacked]           |
| [Primary CTA]                |
| [Content list]               |
+------------------------------+

## Components inventory
List real components once known.
- UNKNOWN

## Interactive elements inventory (every control)
Rules:
- Each control must define: label, type, visible conditions, enabled conditions, action, side effects, analytics, failure handling.

| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| UNKNOWN | UNKNOWN | button/link/input | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

## Page state model
Define explicit states. No vague "it loads".
States (minimum set):
- idle
- loading
- ready
- empty
- error
- forbidden
- stale (optional)
- offline (optional)

State transitions:
- idle -> loading (trigger: UNKNOWN)
- loading -> ready (conditions: UNKNOWN)
- loading -> empty (conditions: UNKNOWN)
- loading -> error (errors: UNKNOWN)
- ready -> loading (refresh trigger: UNKNOWN)

## Data dependencies
- Required data: UNKNOWN
- Optional data: UNKNOWN
- Data sources: UNKNOWN (store, query, cache, local storage)
- Cache invalidation rules: UNKNOWN
- Stale data tolerance: UNKNOWN

## API calls and contracts
List calls made by this page only.
### Call: UNKNOWN
- Trigger: UNKNOWN (on load, on click, on debounce)
- Request: UNKNOWN
- Response: UNKNOWN
- Pagination: UNKNOWN
- Retry strategy: UNKNOWN
- Timeout: UNKNOWN
- Error mapping to UI: UNKNOWN

## Validation and input rules
For each input:
- constraints
- error text
- sanitize rules
- accessibility behavior

- UNKNOWN

## Destructive actions
If anything deletes or irreversibly changes data:
- Confirmations required: UNKNOWN
- Undo support: UNKNOWN
- Audit log requirements: UNKNOWN
- Rate limit / abuse protections: UNKNOWN

## Error handling
Enumerate user-facing errors and what the UI does.
- Network failure: UNKNOWN
- 401 unauthenticated: UNKNOWN
- 403 forbidden: UNKNOWN
- 404 not found: UNKNOWN
- 409 conflict: UNKNOWN
- 422 validation: UNKNOWN
- 429 rate limited: UNKNOWN
- 5xx server: UNKNOWN

## Empty states
- True empty: UNKNOWN
- Filtered empty: UNKNOWN
- First run empty onboarding: UNKNOWN

## Loading strategy
- Skeleton vs spinner vs placeholder: UNKNOWN
- Progressive rendering: UNKNOWN
- Per-section loading: UNKNOWN

## Offline and resiliency (if applicable)
- Offline detection: UNKNOWN
- Read-only fallback: UNKNOWN
- Queue actions: UNKNOWN
- Conflict resolution: UNKNOWN

## Analytics and audit logging
### Analytics events
| Event | Trigger | Properties | Notes |
|------|---------|------------|------|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

### Audit logs (if required)
- What must be recorded: UNKNOWN
- Who initiated: UNKNOWN
- Before/after values: UNKNOWN

## Accessibility requirements
- Focus order: UNKNOWN
- Keyboard navigation: UNKNOWN
- Screen reader labels: UNKNOWN
- Color contrast constraints: UNKNOWN
- Error announcement behavior: UNKNOWN

## Performance constraints
- Max items rendered without virtualization: UNKNOWN
- Pagination vs infinite scroll: UNKNOWN
- Debounce rules: UNKNOWN
- N+1 call risks: UNKNOWN

## Security and abuse cases
Be paranoid and specific.
- Privilege escalation risks: UNKNOWN
- IDOR risks (insecure direct object reference): UNKNOWN
- Injection risks: UNKNOWN
- CSRF/XSS considerations: UNKNOWN
- Data leakage in analytics/logs: UNKNOWN
- Rate limit or scraping: UNKNOWN

## Test plan
- Unit tests: UNKNOWN
- Integration tests: UNKNOWN
- E2E tests: UNKNOWN
- Edge cases worth pinning: UNKNOWN

## Observability
- Logs: UNKNOWN
- Metrics: UNKNOWN
- Traces: UNKNOWN
- Alerts: UNKNOWN

## Feature flags and rollout
- Flags used: UNKNOWN
- Default behavior when flag off: UNKNOWN

## Open questions (UNKNOWN)
List anything not specified. Make it painful and obvious.
- UNKNOWN

## Risks and mitigations
- Risk: UNKNOWN
  - Impact: UNKNOWN
  - Mitigation: UNKNOWN

## Future enhancements
- UNKNOWN

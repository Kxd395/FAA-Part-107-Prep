# Page: Sectional Charts

## Page identity
- Route: `/charts`
- Page slug: `charts`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-24
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- What user problem this page solves: Quick access to chart figures and FAA reference documents used by study/exam content.
- Success criteria (measurable):
  - User opens high-resolution figure asset in new tab.
  - User opens FAA source documents from reference links.
- Non-goals:
  - Interactive chart annotation or in-page zoom controls.
  - Offline chart package management.

## Users and permissions
- Intended roles: `public_user`
- Access denied behavior:
  - If unauthenticated: same behavior
  - If authenticated but forbidden: not applicable
- Controls that must be hidden vs disabled vs visible with error: none role-based.

## Entry points
- From page: header nav -> Charts
- From page: home feature card
- Deep link: direct `/charts`
- Post-auth redirect: not applicable

## Breadcrumbs
- Breadcrumb trail: none rendered
- Breadcrumb rules (dynamic segments): not applicable
- Sensitive breadcrumb masking rules: not applicable

## Navigation map
- Primary onward paths:
  - figure cards -> `/figures/figure-<id>.png` in new tab
- Secondary paths:
  - external FAA reference links
  - back link to `/study`
- Exit points: all links are navigational exits

## ASCII wireframe
Desktop (or primary layout):
+------------------------------------------------------+
| Header Nav                                            |
+------------------------------------------------------+
| H1 + description                                      |
| Figure card grid (6 cards)                            |
| FAA references panel (3 external links)               |
| [Back to Study Mode]                                  |
+------------------------------------------------------+

Mobile:
+------------------------------+
| Header                       |
+------------------------------+
| H1 + text                    |
| Figure cards stacked         |
| FAA links block              |
| Back to Study link           |
+------------------------------+

## Components inventory
- Static figure ID list (`FIGURES`)
- Static FAA links map (`FAA_REFERENCE_LINKS`)
- `next/link` back-navigation link

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `charts.figure[*]` | Figure `<id>` card | anchor | always | always | open `/figures/figure-<id>.png` in new tab | none | none | broken image handled by browser | `link_opened` |
| `charts.ref.uas_acs` | UAS ACS (PDF) | anchor | always | always | open FAA PDF in new tab | none | none | browser/network dependent | `citation_clicked` |
| `charts.ref.ac107` | AC 107-2A (PDF) | anchor | always | always | open FAA PDF in new tab | none | none | browser/network dependent | `citation_clicked` |
| `charts.ref.study_guide` | Remote Pilot Study Guide (PDF) | anchor | always | always | open FAA PDF in new tab | none | none | browser/network dependent | `citation_clicked` |
| `charts.back.study` | Back to Study Mode | link | always | always | navigate `/study` | none | none | none | `link_opened` |

## Page state model
States:
- idle
- ready

State transitions:
- idle -> ready (initial render)

## Data dependencies
- Required data: none remote
- Optional data: none
- Data sources: in-file constants + static assets in `public/figures`
- Cache invalidation rules: asset caching handled by browser/server headers (UNKNOWN specifics)
- Stale data tolerance: static links can drift if FAA URLs change

## API calls and contracts
- None.

## Validation and input rules
- Figure IDs are hardcoded numeric list `[20, 21, 22, 23, 26, 59]`.
- External URLs are hardcoded constants.

## Destructive actions
- Confirmations required: none
- Undo support: none
- Audit log requirements: none
- Rate limit / abuse protections: not applicable

## Error handling
- Network failure: browser-level failure for external link targets
- 401 unauthenticated: not applicable
- 403 forbidden: not applicable
- 404 not found: missing figure asset leads to browser 404 in new tab
- 409 conflict: not applicable
- 422 validation: not applicable
- 429 rate limited: not applicable
- 5xx server: browser-level behavior for failed target

## Empty states
- True empty: not implemented (static card list always renders)
- Filtered empty: not applicable
- First run empty onboarding: not applicable

## Loading strategy
- Skeleton vs spinner vs placeholder: none
- Progressive rendering: browser image loading in card grid
- Per-section loading: none

## Offline and resiliency (if applicable)
- Offline detection: none
- Read-only fallback: page shell still renders; asset/doc links fail offline
- Queue actions: none
- Conflict resolution: not applicable

## Analytics and audit logging
### Analytics events
| Event | Trigger | Properties | Notes |
|------|---------|------------|------|
| `page_view` | charts mount | `route=/charts` | local + optional sink |
| `link_opened` | figure card open, back-to-study link | `target`, `href`, optional `figure` | tracks outbound navigation |
| `citation_clicked` | FAA reference link click | `citationLabel`, `citationUrl` | tracks source-link usage |

### Audit logs (if required)
- What must be recorded: none
- Who initiated: UNKNOWN
- Before/after values: not applicable

## Accessibility requirements
- Focus order: figure links then reference links then back link.
- Keyboard navigation: native anchor/link behavior.
- Screen reader labels: image `alt` text includes figure number.
- Color contrast constraints: UNKNOWN.
- Error announcement behavior: browser-default only.

## Performance constraints
- Max items rendered without virtualization: 6 cards.
- Pagination vs infinite scroll: none.
- Debounce rules: none.
- N+1 call risks: none.

## Security and abuse cases
- Privilege escalation risks: low.
- IDOR risks: low (public static assets).
- Injection risks: low (constant URLs).
- CSRF/XSS considerations: low on static anchors.
- Data leakage in analytics/logs: none.
- Rate limit or scraping: static figures can be scraped.

## Test plan
- Unit tests: UNKNOWN
- Integration tests: verify each figure/reference URL is non-empty and opens target.
- E2E tests: card click opens new tab with figure path.
- Edge cases worth pinning: stale external FAA URLs.

## Observability
- Logs: none
- Metrics: none
- Traces: none
- Alerts: none

## Feature flags and rollout
- Flags used: none
- Default behavior when flag off: not applicable

## Open questions (UNKNOWN)
- Should charts list be generated from manifest instead of hardcoded IDs?
- Should missing assets be detected and hidden pre-render?
- Should this route support in-app zoom viewer with accessibility controls?

## Risks and mitigations
- Risk: FAA external links may become stale.
  - Impact: broken references and reduced trust.
  - Mitigation: periodic link validation task and fallback mirrors.

## Future enhancements
- Build from figure manifest automatically.
- Add search/filter by figure usage or topic.
- Add embedded zoom/pan viewer with keyboard controls.

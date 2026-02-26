# Page: Home

## Page identity
- Route: `/`
- Page slug: `home`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-25
- Related tickets/PRs: N/A (no linked ticket in repo)

## Purpose
- What user problem this page solves: Entry point for selecting a preparation mode, question type profile, and topic-specific drill path.
- Success criteria (measurable):
  - User reaches one of `/study`, `/exam`, `/learn`, `/flashcards`, `/missed`, `/progress`, `/charts`.
  - User-selected `practiceType` is reflected in outbound study/exam links.
- Non-goals:
  - Running quiz logic directly on this page.
  - Persisting session or analytics state.

## Users and permissions
- Intended roles: `public_user`
- Access denied behavior:
  - If unauthenticated: Same behavior as authenticated (no auth)
  - If authenticated but forbidden: Not applicable
- Controls that must be hidden vs disabled vs visible with error: No role-based control gating implemented.

## Entry points
- From page: global header logo, action: navigate to `/`
- Deep link: direct URL hit `/`
- Post-auth redirect: Not applicable

## Breadcrumbs
- Breadcrumb trail: None rendered
- Breadcrumb rules (dynamic segments): Not applicable
- Sensitive breadcrumb masking rules: Not applicable

## Navigation map
- Primary onward paths:
  - `/study?type=<profile>`
  - `/exam?type=<profile>`
  - Feature cards to `/study`, `/exam`, `/flashcards`, `/learn`, `/missed`, `/charts`, `/study?type=weak_spots`
- Secondary paths:
  - Topic cards to `/study?category=<topic>&type=<profile>` and `/exam?category=<topic>&type=<profile>`
- Exit points (logout, cancel, close): None

## ASCII wireframe
Desktop (or primary layout):
+------------------------------------------------------+
| Header Nav: Home | Study | Exam | Flashcards | ...   |
+------------------------------------------------------+
| Hero: title + subtitle                                |
| [Start Studying] [Take Practice Exam]                |
| Practice Question Type [select]                      |
+------------------------------------------------------+
| Stats cards (Questions / Pass / Time / Updated)      |
+------------------------------------------------------+
| Feature cards grid (7 links)                         |
+------------------------------------------------------+
| Topic cards (5) each has [Study] [Test]              |
+------------------------------------------------------+

Mobile:
+------------------------------+
| Sticky Header Nav            |
+------------------------------+
| Hero + CTA buttons stacked   |
| Practice type select         |
| Stats cards (2-column)       |
| Feature cards                |
| Topic cards with Study/Test  |
+------------------------------+

## Components inventory
- `next/link` links for all navigation actions
- `useQuestionBank` for live loaded-bank counts
- Local state: `practiceType` (`useState`, hydrated from per-user preference storage)
- Derived hrefs: `studyHref`, `practiceExamHref`, `studyBookmarksHref`, `examBookmarksHref` (`useMemo`)

## Interactive elements inventory (every control)
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `home.cta.start_studying` | Start Studying | link/button | always | always | Navigate to `/study?type=<practiceType>` | none | none | none | `link_opened` |
| `home.cta.take_exam` | Take Practice Exam | link/button | always | always | Navigate to `/exam?type=<practiceType>` | none | none | none | `link_opened` |
| `home.select.practice_type` | Practice Question Type | select | always | always | Update selected profile | none | `practiceType` updates | none | `filter_changed` |
| `home.quick.study_bookmarks` | Study Bookmarks | link | always | always | Navigate to `/study?collection=bookmarks&type=<practiceType>` | none | none | none | `link_opened` |
| `home.quick.exam_bookmarks` | Exam from Bookmarks | link | always | always | Navigate to `/exam?collection=bookmarks&type=<practiceType>` | none | none | none | `link_opened` |
| `home.card.feature[*]` | Feature card | link | always | always | Navigate to feature route | none | none | none | `link_opened` |
| `home.card.topic.study[*]` | Study (topic) | link | always | always | Navigate with topic+type query | none | none | none | `link_opened` |
| `home.card.topic.test[*]` | Test (topic) | link | always | always | Navigate with topic+type query | none | none | none | `link_opened` |
| `header.nav.*` | Study/Exam/Flashcards/Learn/Missed/Progress/Charts | link | always | always | Navigate to target route | none | none | none | `link_opened` (instrumented in shared header component) |

## Page state model
States:
- idle
- ready

State transitions:
- idle -> ready (trigger: initial render)
- ready -> ready (trigger: practice type select change)

## Data dependencies
- Required data: Loaded question bank for dynamic total/topic counts.
- Optional data: Per-user preferred question type.
- Data sources:
  - API (`useQuestionBank` -> `/api/questions`)
  - localStorage (`part107_default_question_type_v1[:<userId>]`)
  - in-file arrays (`FEATURES`, topic descriptions, source-pack registry metadata)
  - core exam defaults (`EXAM_DEFAULTS`, `FULL_EXAM_QUESTION_COUNT`) for pass/time stat cards
- Cache invalidation rules: Question load follows `useQuestionBank` live/snapshot policies.
- Stale data tolerance: Question counts and exam-policy stat cards now derive from loaded/core constants; feature/topic copy remains static.

## API calls and contracts
List calls made by this page only.
- `GET /api/questions?category=All` via `useQuestionBank`.

## Validation and input rules
- `practiceType` values constrained to `QuestionTypeProfile` enum options in code (including `part107_bank`, `carrington_bank`, and `carrington_strict` for source-pack-only routing).
- If present, per-user preferred question type is normalized against selectable profile list before hydration.
- Route query params are URL-encoded for category and type links.
- Bookmark collection quick links include `collection=bookmarks` and current `type`.
- Error text / sanitize rules: None beyond controlled select values.

## Destructive actions
- Confirmations required: None
- Undo support: None
- Audit log requirements: None
- Rate limit / abuse protections: Not applicable

## Error handling
- Network failure: Not applicable (no fetch)
- 401 unauthenticated: Not applicable
- 403 forbidden: Not applicable
- 404 not found: Handled by framework on destination route
- 409 conflict: Not applicable
- 422 validation: Not applicable
- 429 rate limited: Not applicable
- 5xx server: Not applicable

## Empty states
- True empty: Not applicable
- Filtered empty: Not applicable
- First run empty onboarding: Not applicable

## Loading strategy
- Skeleton vs spinner vs placeholder: None required
- Progressive rendering: Not used
- Per-section loading: Not used

## Offline and resiliency (if applicable)
- Offline detection: None
- Read-only fallback: Entire page is static and still renders offline after load
- Queue actions: None
- Conflict resolution: Not applicable

## Analytics and audit logging
### Analytics events
| Event | Trigger | Properties | Notes |
|------|---------|------------|------|
| `page_view` | route mount | `route=/` | logged once per mount |
| `filter_changed` | practice type select update | `filter=practice_type`, `value`, `questionTypeProfile` | updates funnel context |
| `link_opened` | hero CTA, feature-card link, topic study/test link, and shared header nav links | `target`, `href`, optional `sourcePath` | includes internal navigation telemetry |

### Audit logs (if required)
- What must be recorded: None currently
- Who initiated: UNKNOWN
- Before/after values: UNKNOWN

## Accessibility requirements
- Focus order: Browser DOM order; nav -> hero actions -> select -> cards.
- Keyboard navigation: Native links/buttons/select support.
- Screen reader labels: select is labeled (`htmlFor="practice-type"`).
- Color contrast constraints: UNKNOWN (not audited).
- Error announcement behavior: Not applicable.

## Performance constraints
- Max items rendered without virtualization: Small static sets (feature/topic cards).
- Pagination vs infinite scroll: Not applicable.
- Debounce rules: Not applicable.
- N+1 call risks: None.

## Security and abuse cases
- Privilege escalation risks: Low (no auth boundaries).
- IDOR risks: None on this page.
- Injection risks: Query params are built from controlled values except category names from static list.
- CSRF/XSS considerations: Low on read-only page; destination routes parse query params.
- Data leakage in analytics/logs: No analytics on page.
- Rate limit or scraping: Not applicable.

## Test plan
- Unit tests: UNKNOWN for home page interactions.
- Integration tests: UNKNOWN.
- E2E tests: Should verify select updates outbound hrefs and all primary links resolve.
- Edge cases worth pinning:
  - `practiceType` option coverage
  - Topic link query encoding

## Observability
- Logs: None
- Metrics: None
- Traces: None
- Alerts: None

## Feature flags and rollout
- Flags used: None detected
- Default behavior when flag off: Not applicable

## Open questions (UNKNOWN)
- Is there a requirement for breadcrumb rendering in global layout?

## Risks and mitigations
- Risk: Static copy metrics (non-question stats) can drift from policy changes.
  - Impact: Messaging inconsistency.
  - Mitigation: Move remaining static stat copy to governed content/config source.

## Future enhancements
- Add localization support for labels and copy.
- Add controlled content source for stats cards.

# Page: Login

## Page identity
- Route: `/login`
- Page slug: `login`
- Owner (eng): @kevindialmb
- Owner (product): @kevindialmb (acting)
- Owner (design): @kevindialmb (acting)
- Last updated: 2026-02-24
- Related tickets/PRs: SSOT-AUTH-LOGIN-VISIBILITY

## Purpose
- Let users request a magic-link and verify a token-based sign-in.
- Allow one-click Google sign-in using GIS credential flow.
- Provide a development fallback link when outbound email is not configured.

## Users and permissions
- Intended roles: public visitor, authenticated user
- Access denied behavior:
  - If unauthenticated: page is fully accessible
  - If authenticated but forbidden: not applicable
- Controls hidden/disabled: send button disabled while request is in-flight or email is empty.

## Entry points
- Header nav `Sign In` link.
- Direct deep link `/login`.
- Magic-link email deep link `/login?token=<token>`.

## Breadcrumbs
- None rendered.

## Navigation map
- Success path: `/login?token=...` -> verify -> CTA to `/progress`.
- Alternate path: user can leave to any route via header nav.

## ASCII wireframe
Desktop/mobile:
+--------------------------------------+
| Header nav                           |
+--------------------------------------+
| 🔐 Sign In                           |
| [email input]                        |
| [Send Magic Link]                    |
| status text                          |
| (dev) open sign-in link              |
+--------------------------------------+
| token present: verification card     |
| "Signed in as ..." + continue link  |
+--------------------------------------+

## Components inventory
- Google sign-in button host container (GIS rendered)
- Email input field
- Send Magic Link button
- Verification status panel (conditional)
- Continue link to `/progress` (on success)

## Interactive elements inventory
| Control ID | Label | Type | Visible when | Enabled when | On action | API calls | State changes | Errors | Analytics |
|-----------|-------|------|--------------|--------------|----------|----------|--------------|--------|----------|
| `login.email` | Email | input | always | always | update email | none | `email` | none | none |
| `login.google_sign_in` | Sign in with Google | button | when GIS script + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` available | always | submit credential token to backend and refresh session | `POST /api/auth/google`, `GET /api/auth/session` | `user` session hydrated | inline text | none |
| `login.send_magic_link` | Send Magic Link | button | always | email non-empty and not sending | request link | `POST /api/auth/magic-link` | `sendStatus`, `devMagicLink` | inline text | none |
| `login.verify_token` | (implicit effect) | effect | when `token` query exists | token non-empty | verify token | `POST /api/auth/verify` | `verifyState`, `verifyStatus` | inline text | none |
| `login.continue_progress` | Continue to Progress | link | verify success | always | navigate | none | route change | none | none |

## Page state model
- `idle` -> `sending` -> `sent|error`
- `idle` -> `verifying` -> `verified|error` (when token exists)

## Data dependencies
- Query param: `token` optional
- Auth cookie written by verify route

## API calls and contracts
- `POST /api/auth/google` with `{ credential }`.
- `POST /api/auth/magic-link` with `{ email }`.
- `POST /api/auth/verify` with `{ token }`.

## Validation and input rules
- Email must pass server validation; invalid input returns `400`.

## Error handling
- Invalid email / token / Google credential / rate-limit / send failure shown inline in status text.

## Empty states
- No token query: only magic-link request UI.

## Loading strategy
- Button label switches to `Sending...` during request.
- Token verify section displays `Verifying sign-in link...`.

## Offline and resiliency
- Network failures surface inline and are retryable by re-clicking send.

## Analytics and audit logging
- No route-specific analytics events implemented yet.

## Accessibility requirements
- Email label linked with `htmlFor`.
- Button disabled state announced by native semantics.

## Performance constraints
- No heavy data rendering.

## Security and abuse cases
- Magic-link and verify routes are rate-limited.
- Verify rejects invalid/expired tokens.
- Google route verifies token audience/email verification server-side and is rate-limited.
- `returnUrl` is sanitized client-side to same-origin relative paths before redirecting authenticated users.
- Magic-link base URL now resolves from configured app origins (`APP_BASE_URL`/`APP_ALLOWED_ORIGINS`) with localhost-only fallback outside production.
- App auth + magic-link signing now require explicit secrets outside test (`APP_AUTH_SECRET`, `MAGIC_LINK_SECRET`), with no non-test fallback defaults.

## Test plan
- Route tests: `google`, `magic-link`, `verify` APIs.
- Manual UI check for `/login` request+verify flow.

## Observability
- Server logs magic-link send errors.

## Feature flags and rollout
- None.

## Open questions (UNKNOWN)
- Redirect target after verify (currently `/progress`) should be configurable.

## Risks and mitigations
- Risk: user cannot access dev magic-link email.
  - Impact: blocked local sign-in.
  - Mitigation: return `devUrl` in non-production response and render clickable link.

## Future enhancements
- Add explicit success redirect timer.
- Add auth-aware user menu/profile entry in header.

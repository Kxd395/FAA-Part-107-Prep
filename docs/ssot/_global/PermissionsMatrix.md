# Permissions Matrix

## Roles
- `public_user` (unauthenticated browser user)
- `authenticated_user` (valid `part107_auth` session cookie)

## Actions
Actions are verbs, not pages.

## Matrix
| Action | Role: public_user | Role: authenticated_user | Notes |
|-------|-------------------|--------------------------|------|
| view_home | Allowed | Allowed | `/` route is public |
| view_login | Allowed | Allowed | `/login` route is public |
| view_study | Denied | Allowed | Proxy redirects unauthenticated users to `/login?returnUrl=...` |
| view_exam | Denied | Allowed | Proxy redirects unauthenticated users to `/login?returnUrl=...` |
| view_learn | Denied | Allowed | Proxy redirects unauthenticated users to `/login?returnUrl=...` |
| view_flashcards | Denied | Allowed | Proxy redirects unauthenticated users to `/login?returnUrl=...` |
| view_missed | Denied | Allowed | Proxy redirects unauthenticated users to `/login?returnUrl=...` |
| view_progress | Denied | Allowed | Proxy redirects unauthenticated users to `/login?returnUrl=...` |
| view_charts | Denied | Allowed | Proxy redirects unauthenticated users to `/login?returnUrl=...` |
| view_profile | Denied | Allowed | Proxy redirects unauthenticated users to `/login?returnUrl=...` |
| fetch_questions_api | Allowed | Allowed | `GET /api/questions` has no auth checks |
| auth_session_create | Allowed | Allowed | `POST /api/auth/session` creates/refreshes session cookie |
| auth_session_read | Allowed | Allowed | `GET /api/auth/session` returns auth status |
| auth_session_delete | Allowed | Allowed | `DELETE /api/auth/session` clears cookie |
| auth_magic_link_request | Allowed | Allowed | `POST /api/auth/magic-link` sends/prints magic-link sign-in URL |
| auth_magic_link_verify | Allowed | Allowed | `POST /api/auth/verify` validates token and creates auth cookie |
| user_state_get | Denied | Allowed | `GET /api/user/state` requires `part107_auth` cookie |
| user_state_put | Denied | Allowed | `PUT /api/user/state` requires `part107_auth` cookie |
| user_profile_get | Denied | Allowed | `GET /api/user/profile` requires `part107_auth` cookie |
| user_profile_patch | Denied | Allowed | `PATCH /api/user/profile` requires `part107_auth` cookie |
| sync_upload | Denied | Conditionally allowed | Proxy requires `part107_auth` cookie; route also requires sync auth scheme |
| sync_download | Denied | Conditionally allowed | Proxy requires `part107_auth` cookie; route also requires sync auth scheme |
| persist_local_progress | Allowed | Allowed | Writes browser `localStorage` |
| clear_local_progress | Allowed | Allowed | Reset button deletes local data |

## Enforcement points
- Edge proxy gating:
  - Protected app routes: `/study`, `/exam`, `/flashcards`, `/learn`, `/missed`, `/progress`, `/charts`, `/profile`.
  - Protected API prefixes: `/api/user/*`, `/api/sync/*`.
  - Unauthenticated app requests are redirected to `/login?returnUrl=<path>`.
  - Unauthenticated protected API requests return `401`.
- Backend authorization:
  - None in `apps/web/src/app/api/questions/route.ts`.
  - Cookie-based auth checks on `/api/user/state` and `/api/user/profile` (`part107_auth` signed token).
  - Sync header/token ownership checks in `/api/sync/upload` and `/api/sync/download` after proxy cookie gate.
- Audit log requirements: UNKNOWN (no backend audit sink present).

## Failure behavior
- Unauthorized app route behavior: redirect to `/login` with encoded `returnUrl`.
- Unauthorized protected API behavior: `401` JSON `{ error: "Unauthorized" }`.

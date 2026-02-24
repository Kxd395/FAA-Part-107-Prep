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
| view_study | Allowed | Allowed | `/study` route is public |
| view_exam | Allowed | Allowed | `/exam` route is public |
| view_learn | Allowed | Allowed | `/learn` route is public |
| view_flashcards | Allowed | Allowed | `/flashcards` route is public |
| view_missed | Allowed | Allowed | `/missed` route is public |
| view_progress | Allowed | Allowed | `/progress` route is public |
| view_charts | Allowed | Allowed | `/charts` route is public |
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
| sync_upload | Conditionally allowed | Conditionally allowed | `POST /api/sync/upload` requires sync auth scheme |
| sync_download | Conditionally allowed | Conditionally allowed | `GET /api/sync/download` requires sync auth scheme |
| persist_local_progress | Allowed | Allowed | Writes browser `localStorage` |
| clear_local_progress | Allowed | Allowed | Reset button deletes local data |

## Enforcement points
- Frontend gating: None detected (no role checks, no auth checks).
- Backend authorization:
  - None in `apps/web/src/app/api/questions/route.ts`.
  - Cookie-based auth checks on `/api/user/state` (`part107_auth` signed token).
  - Header/token ownership checks in sync routes (`/api/sync/upload`, `/api/sync/download`).
- Audit log requirements: UNKNOWN (no backend audit sink present).

## Failure behavior
- Unauthorized access UI: Not applicable in current implementation.
- Forbidden route behavior: Not applicable in current implementation.

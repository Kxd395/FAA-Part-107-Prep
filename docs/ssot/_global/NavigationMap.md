# Global Navigation Map

## Route graph
All current web routes discovered from `apps/web/src/app/**/page.tsx`.

[RootLayout Header]
   |
   +--> [/]
   +--> [/login]
   +--> [/study]
   +--> [/exam]
   +--> [/flashcards]
   +--> [/learn]
   +--> [/missed]
   +--> [/progress]
   +--> [/charts]

Home (`/`) deep-links:

[/]
   +--> [/study?type=<questionTypeProfile>]
   +--> [/exam?type=<questionTypeProfile>]
   +--> [/study?category=<category>&type=<questionTypeProfile>]
   +--> [/exam?category=<category>&type=<questionTypeProfile>]
   +--> [/study?type=weak_spots] (from Smart Review card)

Cross-page links:
- `/study` completion -> `/progress`
- `/exam` review -> `/study`, `/progress`
- `/flashcards` completion -> `/study`
- `/charts` footer link -> `/study`
- `/progress` empty state -> `/study`, `/exam`
- `/missed` empty state -> `/study`, `/exam`

## Breadcrumb conventions
Rules in code today:
- No breadcrumb UI is currently implemented on any route.
- Conceptual hierarchy exists (Home -> Mode pages), but it is not rendered as breadcrumbs.
- Breadcrumb truncation rules (mobile): UNKNOWN
- Max breadcrumb depth: UNKNOWN

## Navigation invariants
- Back button behavior: browser history (`next/link` navigations; no custom back-stack manager).
- Deep link handling:
  - `/login` parses optional `token` query param for magic-link verification.
  - `/study` parses `category`, `type`, `focus` query params.
  - `/exam` parses `category`, `type` query params.
  - Unsupported params are ignored or downgraded with warning UI.
- Post-auth redirect rules:
  - `/login?token=...` verifies link and keeps user on `/login` with CTA to continue.
  - Header exposes global `Sign In`/`Sign Out` based on `/api/auth/session` state.
- 404 behavior: UNKNOWN (no custom `not-found.tsx` found).

# Supabase Persistence Setup

Generated: 2026-02-26

## Scope
- Server-side persistence for:
  - `user state` (`/api/user/state`)
  - `learning events` (`/api/user/learning-events`)
- `question issues` (`/api/user/question-issues`)
- Runtime fallback remains local `.data/*.json` if Supabase is unavailable or misconfigured.

## Required `.env.local` setup (exact)
Add this to [`apps/web/.env.local`](/Volumes/Developer/projects/experiments/FAA_107_Study_Guide/apps/web/.env.local):

```bash
# Client-side keys (already used by frontend)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<your-publishable-key>

# Server-side keys (required for persistence tables)
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Important
- `NEXT_PUBLIC_*` keys **alone are not enough** for server persistence.
- `SUPABASE_SERVICE_ROLE_KEY` must be present for `/api/user/state`, `/api/user/learning-events`, and `/api/user/question-issues` to persist in Supabase.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Never expose it in client code.

Optional fallback (not recommended for server writes):

- `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_ALLOW_PUBLISHABLE_FALLBACK=true` (disabled by default)

Optional table overrides:

- `SUPABASE_TABLE_USER_STATE` (default: `part107_user_state`)
- `SUPABASE_TABLE_LEARNING_EVENTS` (default: `part107_learning_events`)
- `SUPABASE_TABLE_QUESTION_ISSUES` (default: `part107_question_issues`)

## Provisioning
1. Open Supabase SQL editor.
2. Run [`docs/engineering/supabase_persistence_schema.sql`](/Volumes/Developer/projects/experiments/FAA_107_Study_Guide/docs/engineering/supabase_persistence_schema.sql).
3. Confirm the three tables are created in `public`.

## Behavior
- Stores attempt Supabase first.
- On any Supabase error (missing table, auth, network), store reads/writes fall back to local `.data`.
- Warnings are emitted through server logger for observability.

## Verify locally
1. Run `npm run dev`.
2. Call authenticated endpoints in app:
  - save state
  - answer questions (learning events)
  - submit a question issue
3. Confirm rows appear in Supabase tables.
4. Optional: temporarily break `SUPABASE_URL` and confirm app still works with fallback.

## Automated readiness check
Run:

- `npm --prefix apps/web run supabase:check`

This verifies:
- required env keys are present
- service-role auth can query all three persistence tables

## Common failure and fix
If you see:

- `FAIL: missing SUPABASE_SERVICE_ROLE_KEY.`

Then your env currently has only `NEXT_PUBLIC_*` keys. Add `SUPABASE_SERVICE_ROLE_KEY` and rerun:

- `npm --prefix apps/web run supabase:check`

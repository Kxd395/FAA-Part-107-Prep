# Enterprise Repository Audit and Hardening Plan

## Scope

Repository: `FAA_107_Study_Guide`  
Date: 2026-02-26

This plan covers engineering standards, CI governance, type safety gates, test rigor, and operational logging.

## Baseline Results (Current Branch)

- `npm run lint`: pass
- `npm run typecheck`: pass (full web source + test scope)
- `npm run test`: pass
- `npm run coverage`: pass (threshold-enforced)
- `npm run build`: pass
- `npm run validate:content`: pass (0 collection health warnings)
- `npm audit --omit=dev`: pass (no production vulnerabilities)

## Implemented in This Hardening Pass

1. Governance and ownership
- Added `CONTRIBUTING.md` with branch policy and required quality gates.
- Added `SECURITY.md` with disclosure/reporting and secret-handling policy.
- Added `.github/CODEOWNERS` for explicit review ownership.
- Added `.editorconfig` for consistent formatting defaults.

2. CI/CD quality gates
- Added `.github/workflows/ci.yml` to run lint, typecheck, tests, coverage, build, and content validation on PR/push.
- Added `.github/workflows/security-audit.yml` for scheduled and manual production dependency audits.
- Added `.github/dependabot.yml` for weekly npm and GitHub Actions dependency updates.

3. Type-safety controls
- Added Node/npm engine constraints to root and workspace package manifests.
- Added root scripts:
  - `typecheck`
  - `coverage`
  - `audit:prod`
  - `ci:verify`
- Cleared historical web test type errors and restored full `tsconfig.json` type checks for the web workspace.

4. Coverage enforcement
- Added `@vitest/coverage-v8@2.1.9` in web/core workspaces.
- Added workspace `test:coverage` scripts and root `coverage` script.
- Enforced minimum coverage thresholds in:
  - `apps/web/vitest.config.ts`
  - `packages/core/vitest.config.ts`

5. Structured logging
- Added `apps/web/src/lib/server/logger.ts`.
- Replaced ad-hoc server/API `console.*` usage in critical paths:
  - rate limiting
  - magic link auth route
  - google auth route
  - question API route
  - password auth dev-mode logging
- Added logger tests in `apps/web/src/lib/server/logger.test.ts`.

6. Content health cleanup
- Added `concept_key` values across all current content question files (77/77 coverage).
- Improved low-specificity citations for flagged airspace/operations items.
- Collection health report now passes with no warnings.

7. Supabase persistence rollout (fallback-safe)
- Added server-side Supabase adapter and table mapping for user state, learning events, and question issue reports.
- Added automatic local `.data` fallback on Supabase connectivity/schema/key failures.
- Added setup and migration docs:
  - `docs/engineering/SupabasePersistenceSetup.md`
  - `docs/engineering/supabase_persistence_schema.sql`
- Added readiness check command:
  - `npm --prefix apps/web run supabase:check`

8. Analytics and issue-triage hardening
- Updated exam-mode attempt logging so every answer selection (including answer changes) emits `answer_submitted` with:
  - `metadata.firstSubmission`
  - `metadata.answerChanged`
- Added question-issue triage aggregation API:
  - `GET /api/user/question-issues/summary`
  - includes top-problem questions, by-mode totals, and by-category totals.
- Added Progress UI triage panel for authenticated users:
  - displays total issue reports, unique questions flagged, latest report recency
  - highlights top-reported question rows with latest note context for cleanup prioritization
  - adds one-click `Queue for Review` action to push flagged IDs into the bookmarks collection
  - adds quick open link to `/study?collection=bookmarks&type=confirmed_test`
- Added regression tests for:
  - exam answer-change attempt logging
  - question issue triage summary aggregation/store
  - question issue triage summary route auth/response shape
  - progress triage panel rendering against `/api/user/question-issues/summary`

## Remaining Optimization Backlog

### P1 (Next)

1. Runtime observability expansion
- Add request correlation IDs in API responses/log context.
- Add lightweight error-rate counters per API route.

### P2 (After P1)

1. Branch protection policy
- Require CI status checks and CODEOWNERS review before merge.

2. Release hygiene
- Add changelog/release-note automation.

3. Supply-chain hardening
- Add pinned action SHAs and SBOM/provenance generation.

## Standards Target State

- Every PR gated by `ci:verify` in CI.
- No unowned code paths.
- Consistent structured server logs for all API failures.
- Source code and tests type-safe by default, with thresholded coverage enforcement in CI.

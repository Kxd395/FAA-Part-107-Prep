# Enterprise Readiness Gradecard

Date: 2026-02-26  
Repo: `FAA_107_Study_Guide`

## Executive Grade

- Web/API/Content platform readiness: **B+ (86/100)**
- iOS track readiness: **D+ (42/100)**
- Program-level readiness (including iOS): **C+ (74/100)**
- Release recommendation: **Conditional Go** for web production with P0/P1 items below; **No-Go** for iOS production until foundation work is complete.

## Evidence Collected (local run)

- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm run test`: pass (web `79` files / `316` tests, core `8` files / `46` tests)
- `npm run coverage`: pass (threshold-enforced)
- `npm run build`: pass (Next.js 16.1.6)
- `npm run validate:content`: pass
  - validated `77` curated source questions
  - runtime bank artifact check pass: `173` runtime questions
- `npm run audit:prod`: pass (`0` vulnerabilities)
- `npm --prefix apps/web run supabase:check`: pass

## Scoring Breakdown

| Domain | Grade | Score | Notes |
|---|---:|---:|---|
| SDLC governance | A- | 9/10 | `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, CI and scheduled security audit are present. |
| Code quality + type safety | A- | 13/15 | Lint and typecheck pass; strong TS test coverage for app/core paths. |
| Test rigor + coverage gates | B | 12/15 | Coverage thresholds enforced, but critical files still have low/zero line coverage in web app areas. |
| Security + auth hardening | B- | 10/15 | Secret checks and auth routes exist; operational auth misconfig remains a recurring deployment risk. |
| Data + content integrity | B+ | 9/10 | Content validation, overlap/citation audits, runtime artifact freshness checks are in place. |
| Observability + operability | C+ | 6/10 | Structured logger exists, but no request correlation IDs, no centralized metrics/alerts/SLOs. |
| Performance + scalability | C+ | 6/10 | Rate limiting and retry/fallback logic exist; no load test baseline or perf budget enforcement in CI. |
| Documentation accuracy | C | 3/5 | Core docs exist, but README/runtime details are partially stale (for example Next.js version guidance). |
| iOS architecture readiness | D+ | 4/10 | SwiftUI prototype exists, but no Xcode project, no CI, no tests, no production backend integration. |
| **Total** |  | **72/100** | Base enterprise score before web uplift bonus. |

Web uplift (execution confidence from passing full gates): **+14**, producing **86/100 web readiness**.

## Findings (ordered)

### P0 (fix first)

1. **Version/documentation drift introduces operational confusion**
- README states Next.js 14 validation guidance while active app uses Next.js 16.1.6.
- Action: normalize README + deployment docs to current runtime and exact supported Node matrix.

2. **Auth reliability remains environment-sensitive in production**
- Google/magic-link routes are hardened, but deployment still fails when env/audience/origin values drift.
- Action: add startup/auth-config self-check endpoint and fail-fast deployment validation script in CI/CD.

3. **iOS app is not production-bootstrapped**
- iOS code is source-only scaffold (no checked-in Xcode project/workspace/tests pipeline).
- Action: create committed iOS project structure with build/test lanes before feature expansion.

### P1 (next)

1. Add API request correlation IDs and include them in all structured logs + client-visible error payloads.
2. Add lightweight route metrics (latency/error/429 counts) and alerting thresholds.
3. Enforce branch protection in GitHub (required checks + required review).
4. Introduce smoke E2E for auth + `/api/questions` + one full study/exam flow.
5. Add a pinned-actions policy and SBOM/provenance generation for supply-chain posture.

### P2 (after P1)

1. Raise coverage floors by area (for example `api/*`, auth, sync, scoring).
2. Add automated load/perf checks for question APIs and sync endpoints.
3. Add release versioning/changelog automation and environment promotion checklist.

## Enterprise Go/No-Go

- **Web/API:** Go for controlled production use after P0 docs/auth validation cleanup.
- **iOS:** No-Go for production; proceed with Phase 0/1 foundation plan before mobile beta.

## Immediate 2-Week Plan

1. Close P0 items (README/runtime alignment, auth self-check, iOS project bootstrap).
2. Implement P1 observability baseline (correlation IDs + route metrics + dashboard).
3. Add auth E2E and one full happy-path session E2E in CI.
4. Re-run this gradecard and target **A- web readiness**.

## Remediation Update (2026-02-26, follow-up pass)

Completed in this pass:
- Added request ID propagation (`x-request-id`) and route-level latency/status counters.
- Added internal auth config health endpoint: `GET /api/_internal/auth-config`.
- Added deployment auth-config check script and CI auth check step.
- Updated README runtime/version and runtime-bank counts to current validated values.
- Added perf smoke script for API baseline checks (`perf:smoke`).

Revised web readiness estimate after these changes: **A- (90/100)**.  
Remaining blockers to reach `A`:
1. Add branch protection enforcement in GitHub settings.
2. Add E2E smoke path for auth + one full study/exam flow.
3. Add load/perf baseline execution in CI for protected branches.

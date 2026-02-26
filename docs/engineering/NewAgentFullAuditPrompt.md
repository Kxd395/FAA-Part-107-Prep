# Prompt: Full Enterprise Audit (For a New Agent)

Use this prompt as-is when onboarding a new coding/review agent.

---

You are auditing a production-oriented monorepo for enterprise readiness.

## Objective
Deliver a full technical audit with severity-ranked findings, a letter-grade scorecard, and a prioritized execution plan.

## Repository Context
- Repo: `FAA_107_Study_Guide`
- Stack: Next.js web app, TypeScript core package, content pipeline package, SwiftUI iOS scaffold
- Expected standards: production safety, type safety, CI enforcement, security hygiene, observability, reproducibility, clear docs

## Audit Rules
1. Findings first, ordered by severity (`P0`, `P1`, `P2`, `P3`).
2. No vague statements. Every finding must include:
- Why it matters
- Evidence (file path + command output summary)
- Remediation recommendation
3. Distinguish between:
- `Configured` (policy exists)
- `Enforced` (automated gate blocks regressions)
- `Verified` (you ran it now)
4. If uncertain, say `UNKNOWN` and explain how to resolve uncertainty.

## Required Checks
Run and report results for:

```bash
npm run lint
npm run typecheck
npm run test
npm run coverage
npm run build
npm run validate:content
npm run audit:prod
npm --prefix apps/web run supabase:check
```

Also inspect at minimum:
- `.github/workflows/*`
- `.github/CODEOWNERS`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `README.md`
- `docs/engineering/*`
- `docs/ssot/_global/*`
- `apps/web/src/app/api/**/*`
- `apps/web/src/lib/server/**/*`
- `apps/ios/**/*`

## Gradecard Format
Produce a 0-100 score with letter grade per domain:
- SDLC/Governance
- Build/Release/CI
- Type Safety/Code Quality
- Testing/Coverage
- Security/Auth/Secrets
- Data Integrity/Content Quality
- Observability/SRE
- Performance/Scalability
- Documentation Accuracy
- Mobile (iOS) Readiness

Include:
- `Web readiness grade`
- `iOS readiness grade`
- `Program-level grade`
- `Go/No-Go` recommendation per track

## Output Structure
1. **Top Findings** (P0->P3)
2. **Gradecard Table**
3. **Risk Register** (risk, impact, owner, due window)
4. **30/60/90 Day Plan**
5. **Quick Wins (this week)**
6. **Appendix: command evidence**

## Constraints
- Do not modify app behavior unless explicitly asked.
- You may add/update audit docs under `docs/engineering/`.
- Keep recommendations implementation-ready (clear file targets and acceptance criteria).

## Acceptance Criteria
Your audit is complete only when all are true:
- Commands executed and summarized
- Gradecard with explicit scoring rationale
- Prioritized plan with owners and sequencing
- Go/No-Go decision with clear gates to change status

---

Optional closeout template:

- Overall: `<grade>`
- Web: `<grade>`
- iOS: `<grade>`
- Blockers: `<list>`
- Proceed now with: `<top 3 actions>`

# Question Bank Optimization Plan

Generated: 2026-02-26

## Goal
Maintain one clean, auditable question source while preserving category filters and runtime stability.

## Current state
- Runtime `/api/questions` local mode serves:
  - 112 merged canonical questions (`packages/content/knowledge/combined_question_bank.canonical.json`)
  - +12 curated docx supplemental questions (`packages/content/knowledge/knokegeupdate_question_bank.curated.json`)
- Total served now: **117** active questions after dedupe + unresolved-figure gating.

## What is already fixed
- Canonical merged bank is normalized to app `Question` shape.
- Build/test/typecheck/content validation are passing in CI gate (`npm run ci:verify`).
- Coverage thresholds are enforced in Vitest config for web/core.

## Surgical next steps
1. Keep a single runtime source contract.
- Treat `combined_question_bank.canonical.json` as the only imported external bank.
- Keep local category packs as first-party curated content.

2. Add a semantic-overlap audit gate.
- Add a script that flags high-similarity question pairs across local packs and merged bank.
- Output report to `docs/ssot/review/knokegeUpdate/` for human review before removal.

3. Add source lifecycle metadata.
- Add `status` (`active`, `archived`) and `reviewed_at` to canonical bank rows.
- Exclude archived rows at loader level without deleting source history.

4. Optional consolidation (if desired).
- Generate one `runtime_question_bank.canonical.json` artifact that unions local + merged.
- Keep category filtering in API (no behavior change) while reducing file scatter.

5. Add release guardrails.
- Fail content validation on missing citations, invalid option sets, or stale archived references.
- Keep non-blocking warnings for near-duplicates until reviewed.

## Recommendation
Use canonical-only runtime source now, and run semantic-overlap audit before importing any additional raw sources.

## 2026-02-26 import note
- Imported `docs/ssot/review/knokegeUpdate/more questions.docx` through extracted JSON + curated filter.
- Applied keep policy: include non-Regulation rows only to reduce already-heavy Regulations skew.
- Import result: kept `12/35`, dropped `23/35` (see `MoreQuestionsImportReport.md`).

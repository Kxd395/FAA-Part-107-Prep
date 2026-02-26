# Question Bank Optimization Plan

Generated: 2026-02-26

## Executive Summary

- The current API default pool is **622 questions**.
- The `622` is correct and comes from:
  - Core JSON packs: `77`
  - Part107 bank: `100`
  - Carrington bank: `342`
  - Carrington strict bank: `103`
- There are **103 exact duplicates** in the served pool.
- Root cause: `carrington` and `carrington_strict` are both loaded at the same time, and strict entries are duplicates of Carrington question stems/options/answers.

## Audit Findings

## 1) Why the app reports 622

The questions API currently builds one combined local array containing all four banks:

- Core (`packages/content/questions/*.json`)
- `part107_question_bank.json`
- `carrington_question_bank.json`
- `carrington_question_bank.strict.json`

This sums to `77 + 100 + 342 + 103 = 622`.

## 2) Duplicate profile

- Total rows in current combined pool: `622`
- Unique by exact question signature (stem + options + answer): `519`
- Duplicates removed by exact de-duplication: `103`
- Duplicate groups: `103`
- Every duplicate pair is from `carrington` + `carrington_strict`.

## 3) ID collision risk

- Unique IDs in current served set: `519`
- Duplicate ID groups: `103`
- Current mapping uses `CAR-###` for both `carrington` and `carrington_strict`, producing ID collisions.

Impact:
- Repeated questions in user sessions.
- Inflated/biased sampling toward duplicated items.
- Potential progress/analytics/keying inconsistencies due to duplicated IDs.

## Recommended Direction

Use **one active source pack at a time** for user-facing sessions, and never merge strict + non-strict into a single default pool.

Recommended default policy:
- Keep default pool as `core + part107 + carrington` (519 unique now).
- Make `carrington_strict` opt-in profile only.

Alternative policy:
- Replace `carrington` with `carrington_strict` for a smaller, curated default (`280` total rows).

## Phased Plan

## Phase 0: Immediate Safety Fix (same day)

1. Stop loading `carrington_strict` in the default local pool.
2. Add API guard test: served question IDs must be unique.
3. Add API guard test: no exact duplicate question signatures in default pool.
4. Emit `meta.rawTotal` and `meta.servedTotal` in `/api/questions` for transparency.

Exit criteria:
- Default `All` pool has no exact duplicates.
- Default `All` pool has no duplicate IDs.

## Phase 1: Source-Pack Contract (1-2 days)

1. Add explicit source-pack selection to `/api/questions` (example: `sourcePack=default|core|part107|carrington|carrington_strict`).
2. Keep strict-only mode available, but never auto-merged with full Carrington.
3. Update UI/session presets to choose source pack intentionally.
4. Update docs and tests for expected counts per source pack.

Exit criteria:
- Product behavior is deterministic and user-visible by pack.
- Tests assert expected count ranges per pack.

## Phase 2: De-dup + ID Policy Hardening (1-2 days)

1. Enforce globally unique IDs at build/audit time.
2. If strict and non-strict must coexist for internal tooling, namespace IDs (`CAR-` vs `CARS-`).
3. Add a build script that fails CI on:
  - duplicate IDs
  - exact duplicate signatures
4. Store and report duplicate manifests under `docs/ssot/review/`.

Exit criteria:
- CI fails on duplicate IDs/signatures before release.

## Phase 3: Content Quality Optimization (ongoing)

1. Add/normalize `concept_key` coverage across all banks.
2. Add near-duplicate detection (semantic fingerprint review queue).
3. Rebalance category distribution targets for mixed packs.
4. Prioritize citation specificity improvements in flagged items.

Exit criteria:
- >= 95% concept-key coverage for active packs.
- Near-duplicate review queue maintained and shrinking.

## Decision Checklist

Product/Content needs to decide:

1. Default learning mode:
   - `core + part107 + carrington` (broader, 519 unique), or
   - `core + part107 + carrington_strict` (tighter, 280 total).
2. Should strict be user-selectable only, or internal only?
3. Should mixed-pack mode ever be exposed to end users?

## Proposed Acceptance Metrics

- Duplicate ID rate: `0%` in any served pool.
- Exact duplicate signature rate: `0%` in any served pool.
- `/api/questions` returns pack metadata and deterministic counts.
- Regression tests cover:
  - pack isolation
  - uniqueness constraints
  - count sanity by pack.

# Carrington Source Review

- Source: `/source-materials/Drone_Exam_Prep_Carrington.md`
- Reviewed on: 2026-02-25

## Parseability
- File length: 12,904 lines.
- The markdown is OCR/ebook-converted and includes layout artifacts (`[]{#...}`, `.class_*`, inline SVG/image wrappers).
- MCQ block indicators detected:
  - `Answer: X.` markers: ~360
  - `A.` option markers: ~359
- Conclusion: It is machine-extractable, but requires cleanup normalization before safe import.

## Coverage Snapshot vs Current Bank
- Current active bank total: 177 questions (`77 core + 100 part107 source pack`).
- Carrington clearly contains additional question material in these domains:
  - Regulations, Airspace, Weather, Loading/Performance, Operations, CRM, Airport Ops, Radio, ADM, Physiology.
- Detected likely gaps worth adding/strengthening in current pool:
  - Explicit LAANC authorization framing
  - More Class D / Class E edge-case authorization prompts
  - Warning Area terminology
  - Accident reporting edge-case wording variants

## Risks
- Some items appear generic or potentially outdated in phrasing.
- Some answer keys may conflict with current FAA wording updates.
- Direct import without source/provenance and citation checks can degrade exam realism.

## Implementation Status (Completed 2026-02-25)
1. Extracted MCQ blocks into normalized JSON:
   - `docs/ssot/review/carrington_question_bank.json` (351 items)
2. Added app integration as separate selectable pool:
   - `carrington_bank` in Study / Exam / Flashcards (+ Home selector)
3. Added API loader + source tagging:
   - `source: carrington-question-bank`
   - `source_type: resource_pack`
4. Added adaptive grouping support:
   - `concept_key` enrichment path in API canonicalization.

## Remaining Hardening
1. Validate answer keys/citations against FAA-primary references (Part 107, ACS, FAA-CT-8080-2H).
2. Prune low-value/generic questions that are weak exam proxies.
3. Add provenance fields per question where a concrete regulation/citation can be mapped.

## Automated Citation Gate
- Gate script: `packages/content/scripts/audit-carrington-citations.js`
- Report output: `docs/ssot/review/CarringtonCitationGate.md`
- Rule: any row marked `confirmed_test_eligible: true` must include explicit FAA citation mapping, or the gate fails.

## Quality Trim Status
- Trim script: `packages/content/scripts/trim-carrington-bank.js`
- Current curated size: `342` kept from `351` original rows.
- Strict curated profile size: `103` kept from `351` original rows (`trim:carrington:strict`).
- Strict output file: `docs/ssot/review/carrington_question_bank.strict.json`
- Strict report: `docs/ssot/review/CarringtonTrimReport.strict.md`
- Backup of untrimmed source: `docs/ssot/review/carrington_question_bank.untrimmed.json`
- Latest trim report: `docs/ssot/review/CarringtonTrimReport.md`

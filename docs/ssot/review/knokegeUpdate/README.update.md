# Knowledge Folder

This folder contains runtime question-bank artifacts used by the web API.

Canonical runtime files:

- `part107_question_bank.json`
- `part107_images_needed.json`
- `carrington_question_bank.strict.json`
- `carrington_question_bank.json` (retained for tooling/legacy profile support)
- `knokegeupdate_question_bank.curated.json` (curated non-regulation supplement from `more questions.docx`)

Canonical local category packs (maintained first-party content):

- `packages/content/questions/regulations.json`
- `packages/content/questions/airspace.json`
- `packages/content/questions/weather.json`
- `packages/content/questions/operations.json`
- `packages/content/questions/loading_performance.json`

Notes:

- App loaders prefer this folder first.
- Loaders keep a fallback to `docs/ssot/review/*` for backward compatibility.
- Review reports and extraction scripts may still write to `docs/ssot/review`.

Generated artifacts:

- `combined_question_bank.json` (generated 2026-02-26): Part107 bank plus selected Carrington questions (NOTAM/TFR and METAR/TAF decoding). Carrington imports are assigned IDs 101-112.
- `combined_bank_dedupe_report.md` (generated 2026-02-26): Included/excluded mapping and rationale.
- `more_questions.extracted.json` (generated 2026-02-26): extracted JSON payload from `more questions.docx`.
- `MoreQuestionsImportReport.md` (generated 2026-02-26): keep/drop rationale for docx import.

Current runtime totals (local mode):

- Canonical merged bank (base): 112
- Curated knokegeUpdate supplement: +12 (non-Regulation only)
- Active total served by `/api/questions` local mode (after dedupe and figure gating): 117

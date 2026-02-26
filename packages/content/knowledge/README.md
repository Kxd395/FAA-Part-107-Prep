# Knowledge Folder

This folder contains runtime question-bank artifacts used by the web API.

Canonical runtime files:

- `part107_question_bank.json`
- `part107_images_needed.json`
- `carrington_question_bank.strict.json`
- `carrington_question_bank.json` (retained for tooling/legacy profile support)
- `combined_question_bank.canonical.json` (normalized merged runtime bank)
- `knokegeupdate_question_bank.curated.json` (curated non-regulation supplement imported from `knokegeUpdate/more questions.docx`)
- `runtime_question_bank.json` (single runtime artifact consumed by `/api/questions` local mode)

Canonical local category packs:

- `packages/content/questions/regulations.json`
- `packages/content/questions/airspace.json`
- `packages/content/questions/weather.json`
- `packages/content/questions/operations.json`
- `packages/content/questions/loading_performance.json`

Notes:

- App loaders prefer this folder first.
- Loaders keep a fallback to `docs/ssot/review/*` for backward compatibility.
- Review reports and extraction scripts may still write to `docs/ssot/review`.
- `/api/questions` local mode serves `runtime_question_bank.json` first.
- Regenerate canonical merged bank with:
  - `npm run build:combined-canonical --workspace=@part107/content`
- Regenerate knokegeUpdate supplement with:
  - `npm run build:knokegeupdate-supplement --workspace=@part107/content`
- Regenerate runtime artifact with:
  - `npm run build:runtime-bank --workspace=@part107/content`

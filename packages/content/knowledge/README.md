# Knowledge Folder

This folder contains runtime question-bank artifacts used by the web API.

Canonical runtime files:

- `part107_question_bank.json`
- `part107_images_needed.json`
- `carrington_question_bank.strict.json`
- `carrington_question_bank.json` (retained for tooling/legacy profile support)

Notes:

- App loaders prefer this folder first.
- Loaders keep a fallback to `docs/ssot/review/*` for backward compatibility.
- Review reports and extraction scripts may still write to `docs/ssot/review`.

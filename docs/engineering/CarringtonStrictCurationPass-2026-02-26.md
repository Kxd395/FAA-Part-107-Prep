# Carrington Strict Curation Pass (2026-02-26)

## Scope

Applied a conservative curation pass to `packages/content/knowledge/carrington_question_bank.strict.json` based on three high-confidence categories:

1. Outdated or incorrect rule framing.
2. Out-of-scope for Part 107 knowledge-test prep.
3. Redundant with existing `part107_question_bank.json` coverage.

## Result

- Strict bank before: **103**
- Strict bank after: **42**
- Removed: **61**

Runtime question-bank total in `/api/questions` local mode:

- Local canonical categories: 77
- Part107 bank: 100
- Carrington strict: 42
- Total: **219**

## Removed IDs

`1,2,4,5,6,7,8,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,27,28,30,33,34,35,37,40,44,62,63,64,65,66,67,68,69,70,73,75,77,81,82,83,84,85,86,88,89,90,91,92,93,94,96,97,98,100,103`

## Notes

- This pass intentionally did **not** remove optional weather/TFR practice candidates unless they were already in the three high-confidence remove groups.
- `apps/web/src/app/api/questions/route.test.ts` bounds were updated to match the new expected aggregate range.

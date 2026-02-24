# SSOT: Single Source of Truth

## What this is
This folder is the authoritative spec for app behavior at the page and system level.

## What this is NOT
- A marketing doc
- A vague PRD
- A design-only artifact
- A substitute for code comments or API docs

## Update rules
- Any UI change that affects user behavior must update the relevant page doc before or alongside the code change.
- Any API contract change must update `_global/APIContracts.md` and every page that calls it.
- Any new event tracking must update `_global/AnalyticsSchema.md`.

## PR checklist gate
- PRs must complete the SSOT checklist in [PULL_REQUEST_TEMPLATE.md](/Volumes/Developer/projects/experiments/FAA_107_Study_Guide/.github/PULL_REQUEST_TEMPLATE.md).
- If a PR changes behavior but does not modify SSOT docs, it must include a written justification in the PR template.

## Ownership
- Product owner: @kevindialmb (acting)
- Engineering owner: @kevindialmb
- Design owner: @kevindialmb (acting)
- Security owner: @kevindialmb (acting)

## Files
- `ArchitectureAscii.md`: single-file end-to-end architecture map (pages, APIs, adaptive loop, storage)
- `_global/NavigationMap.md`: route graph and breadcrumb conventions
- `_global/PermissionsMatrix.md`: roles x actions
- `_global/DataModel.md`: entities and identifiers
- `_global/APIContracts.md`: endpoints and response shapes
- `_global/AnalyticsSchema.md`: events and properties
- `_global/ErrorCatalog.md`: standardized error codes and UI treatments
- `_global/SyncContractDraft.md`: proposed cross-device sync envelope and conflict policy draft
- `pages/sync-integration.md`: sync environment matrix, auth modes, and deployment/resiliency behavior
- `pages/*.md`: page-level SSOT

## Quality gates
A page SSOT is considered "complete" only if:
- Every interactive control is listed with preconditions and outcomes
- Loading, empty, error, and permission-denied states are defined
- Analytics events are defined for critical actions
- Tests are specified for main flows and edge cases

# Contributing

## Prerequisites

- Node.js `20.x` or `22.x`
- npm `10+`

## Setup

```bash
npm ci
npm run ci:verify
```

## Branching

- Create branches with `codex/` prefix.
- Keep PRs focused and small.
- Do not mix product/content edits with infra changes unless required.

## Required Checks

Before opening a PR, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run validate:content
```

Or run the combined gate:

```bash
npm run ci:verify
```

## Pull Requests

- Link issues or context.
- Describe behavior changes and risk.
- Add or update tests when changing behavior.
- Include screenshots for UI changes.

## Content Changes

- Keep source of truth under `packages/content` and `packages/content/knowledge`.
- Run `npm run validate:content` after any question/content update.

## Security

Do not commit secrets. Use `.env.local` for local environment values and see `SECURITY.md` for reporting.

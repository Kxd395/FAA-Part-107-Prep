# Next.js Dev Cache Recovery

Use this when dev server errors look like:

- `Error: Cannot find module './276.js'`
- require stack references inside `apps/web/.next/server/...`

## Quick fix

From repo root:

```bash
nvm use 20
bash tools/clear-next-cache.sh
cd apps/web
npm run dev
```

If `nvm` is not installed, ensure `node -v` reports a `20.x` version.

## Why this happens

- Hot-reload can leave stale chunk references in `.next` during interrupted rebuilds.
- Clearing `.next` forces a fresh compile and resolves broken chunk maps.

## Optional helper

You can also run:

```bash
cd apps/web
npm run dev:clean
```

## Known startup hang guard

- This repo now blocks `npm run dev` on Node `22+` and prints an explicit message.
- Next.js `14.2.x` in this codebase is validated on Node `20 LTS`.

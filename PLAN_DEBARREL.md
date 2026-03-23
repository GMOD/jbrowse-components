# Barrel File Removal Plan

## Background

Barrel files (`index.ts` files that only re-export from other modules) cause:
- Slower Jest test runs (entire module graphs loaded per import)
- Degraded tree-shaking (bundler can't statically prune unused exports)
- Collapsed dependency graphs (any change appears to affect all consumers)
- Slower TypeScript language server (must parse full transitive graph)

## Codebase Inventory

- **~263** `index.ts` files in `src/` directories across the monorepo
- **~65** are pure barrel files (only re-exports) — primary targets
- **~198** are mixed files (real code + exports) — need splitting first
- Module system: ESM (`"type": "module"` in root `package.json`)
- Build: `tsc` per package + Webpack 5 for products
- Tests: Jest 30
- Path aliases: defined in `tsconfig.json` (e.g. `@jbrowse/core/*`)

## Recommended Tool: `unbarrelify`

The project uses ESM throughout, which satisfies `unbarrelify`'s primary requirement. It is the most complete automated solution: detects pure barrels, rewrites all consumers to direct import paths, and deletes the barrel files.

```bash
pnpm dlx unbarrelify --check   # dry run — shows what would change
pnpm dlx unbarrelify --write   # apply rewrites + delete barrels
```

For pure barrel files this is fully automated. Mixed files require a manual split step first (see Phase 2).

## Phases

### Phase 1 — Prevent regression (before any cleanup)

Add `eslint-plugin-barrel-files` to `eslint.config.mjs` at `warn` severity:

```bash
pnpm add -Dw eslint-plugin-barrel-files
```

```js
// eslint.config.mjs
import barrelFiles from 'eslint-plugin-barrel-files'

// add to config array:
{
  plugins: { 'barrel-files': barrelFiles },
  rules: {
    'barrel-files/avoid-barrel-files': 'warn',
    'barrel-files/avoid-re-export-all': 'warn',
  },
}
```

This surfaces violations without blocking CI. Promote to `'error'` once the codebase is clean.

### Phase 2 — Split mixed index files

Mixed files (code + re-exports in the same `index.ts`) must be split before `unbarrelify` can process them, since `unbarrelify` only touches files that are _purely_ re-exports.

Priority targets (largest impact):

| File | Lines | Exports |
|---|---|---|
| `packages/core/src/util/index.ts` | 1237 | 107 |
| `packages/core/src/util/types/index.ts` | 491 | 68 |

Strategy for each:
1. Move the implementation code into a dedicated file (e.g. `util/colorUtils.ts`, `util/types/mst.ts`)
2. Leave `index.ts` as a pure barrel pointing at the new file
3. `unbarrelify` will then handle rewriting consumers in Phase 3

### Phase 3 — Automated rewrite of pure barrel consumers

```bash
# Dry run first — review the output
pnpm dlx unbarrelify --check

# Apply rewrites and delete pure barrel files
pnpm dlx unbarrelify --write --organize-imports
```

`--organize-imports` deduplicates and sorts imports after rewriting, avoiding noisy diffs from merged import statements.

After running:
- Build all packages: `pnpm build`
- Run the full test suite: `pnpm test`
- Fix any import errors (usually path alias resolution issues)

### Phase 4 — Handle path aliases

`unbarrelify` may not resolve `@jbrowse/core/*` path aliases correctly. Imports that used a barrel to bridge an alias will need to be reviewed manually or with a targeted search:

```bash
# Find any remaining barrel-style imports after Phase 3
grep -r "from '@jbrowse/core/index'" packages/ plugins/ products/
grep -r "from '@jbrowse/app-core'" packages/ plugins/ products/
```

For package-level entrypoints (`@jbrowse/core`, `@jbrowse/app-core`, etc.) that are part of the public API, keep a single `index.ts` barrel as the published entrypoint — only remove internal barrels.

### Phase 5 — Cleanup and governance

```bash
# Remove orphaned re-exports after barrel deletion
pnpm dlx knip --fix
```

Then promote ESLint rules from `warn` → `error`:

```js
'barrel-files/avoid-barrel-files': 'error',
'barrel-files/avoid-re-export-all': 'error',
```

## What NOT to Remove

- `packages/*/src/index.ts` files that are the **public entrypoint** for a published package (these are needed for consumers of `@jbrowse/*` packages)
- Any `index.ts` explicitly listed in a package's `package.json` `"exports"` field
- `index.ts` files inside `__tests__/` directories

## Expected Outcomes

Based on Atlassian's measurements on a comparable TypeScript monorepo:
- Significantly faster Jest test runs (each test file loads only what it needs)
- Faster `tsc` type-checking (isolated module graph per file)
- More accurate CI change detection (fewer files affected per commit)
- Better tree-shaking in Webpack production builds

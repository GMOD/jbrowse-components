---
name: emitted-declarations-name-undeclared-packages
description: About 20 packages publish `.d.ts` files that `import("…")` a package their manifest does not declare, mostly `@jbrowse/quick-lru` and `@gmod/newick`, because `declaredDependencies.test.ts` reads only `src/`. A consumer whose package manager does not hoist gets those types as errors, or as `any` under `skipLibCheck`.
---

# Emitted declarations name undeclared packages

`scripts/declaredDependencies.test.ts` checks that every import in a package's
`src/` is in its `dependencies` or `peerDependencies`. tsc also writes
`import("pkg")` into an emitted `.d.ts` wherever it inlines an inferred type
from another package, a composed MST model above all. Nothing checks those.

Measured after `pnpm build:esm` on 2026-10-22 (count of `import("…")` sites):

| Package | Undeclared in its `.d.ts` |
| --- | --- |
| `plugins/gwas` | `@jbrowse/tree-sidebar` (41), `@gmod/newick` (4) |
| `plugins/marks`, `canvas`, `variants`, `wiggle`, `maf` | `@gmod/newick` (4–5) |
| `plugins/maf` | `@jbrowse/display-ui` (4) |
| `plugins/sv-inspector` | `@mui/x-data-grid` (10), `@jbrowse/render-core` (20) |
| `packages/tables` | `@jbrowse/alignments-core` (1) |
| `packages/web-core` | `@mui/material` (4) |
| `plugins/hic` | `rxjs` (1) |
| `plugins/authentication` | `@gmod/range-cache-filehandle` (6) |
| `plugins/wiggle` | `generic-filehandle2` (1) |
| `plugins/linear-genome-view` | `@jbrowse/display-test-utils` (5), a test harness leaking into published types |
| 14 more | `@jbrowse/quick-lru` (2–150) |

## The work

- Add the `.d.ts` pass to `scripts/check-declaration-leaks.ts`, which already
  walks every `esm/` after `build:esm`. Strip comments first: a JSDoc line
  holding "from 'x'" otherwise reads as an import.
- Declare each package the pass names, or give the exported surface an
  explicit type so tsc stops inlining it. `display-test-utils` in
  linear-genome-view's types is the one to chase rather than declare.

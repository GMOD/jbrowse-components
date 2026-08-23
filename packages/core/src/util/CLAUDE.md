# packages/core/src/util

**A module here imports its siblings by path, not through `./index.ts`.**
`no-restricted-imports` in `eslint.config.mjs` fails the barrel import and says
why: `index.ts` is 68 value re-export statements, so one edge through it puts
the whole package in the importing module's graph — `fetchContext.ts` reached
`getSession` that way and carried 122 files for it.
`scripts/moduleClosure.test.ts` holds the leaves to a ceiling.

The barrel itself is unaffected and must stay whole: `@jbrowse/core/util` is a
plugin ABI module (`reference/PLUGIN_ABI_STABILITY.md`), so nothing is ever
dropped from it — this is only about how the package talks to itself.

**A plain-data type comes from `./types/data.ts`, not `./types/index.ts`.** The
`Region`, the four file locations and the plugin-store shapes live in the data
file; `types/index.ts` beside it is `AbstractSessionModel` and its thirty
relatives, and next to that a `PluginManager` import. `bpUtils.ts` importing
`Region` from the wrong one of the two is a 6-file type graph becoming a
367-file one. `types/index.ts` re-exports the data half, so an outside caller
sees no difference.

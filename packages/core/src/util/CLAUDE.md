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

**A module that wants one service asks for one service.** `getSession` returns
`AbstractSessionModel`, so importing it costs what naming the whole application
costs — `fetchContext.ts` needed `rpcManager.call` and carried 369 type files
for it. `types/services.ts` declares the slices (`RpcHost`, `PaletteHost`,
`NotificationSink`, `DialogHost`) and `sessionServices.ts` the accessors that
return them; `AbstractSessionModel` extends all of them, so a session still
satisfies every one and nothing that already compiles changes. `parentWalk.ts`
holds the ancestor walk itself, which is why the accessors do not go through
`mstUtils.ts`.

`types/renderingServices.ts` is the exception and the finding: an
`AssemblyManager` is an MST model a `PluginManager` built, so `AssemblyHost` and
`RenderingServices` cost the whole graph no matter how they are asked for. They
sit in their own file so the four cheap slices stay cheap.

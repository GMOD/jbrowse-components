---
name: v430s-per-view-highlight-setting-is-dropped-on-load
description: decide migration vs upgrade-guide note; MST ignores the key either way
metadata:
  area: session, compat
  category: ready
---

# v4.3.0's per-view highlight setting is dropped on load

`highlightsVisible` was lifted from a per-view LGV prop (v4.3.0
`plugins/linear-genome-view/src/LinearGenomeView/model.ts:215`,
`types.optional(types.boolean, true)`, persisted as `false` by that model's
`postProcessSnapshot`) and from the GridBookmark widget into one session-wide
`types.stripDefault(types.boolean, true)` at
`packages/product-core/src/Session/BaseSession.ts:118`. There is no entry for it
in `packages/product-core/src/sessionMigrations/index.ts`.

MST ignores a snapshot key it no longer declares — `ModelType.isValidSnapshot`
iterates only `propertyNames` — so a v4.3.0 session saved with `views: [{ …,
highlightsVisible: false }]` loads without complaint and the band the user
dismissed comes back, on every view at once. Not a load failure, and the new
default is the safe direction, which is why this sits below the ABI entry; it is
still a saved session that reopens showing something the user turned off.

**First move: decide whether it earns a migration.** One `sessionMigrations`
entry folding any per-view `false` into the session-level flag is a few lines;
the alternative is to say a highlight band is cheap to re-dismiss and write the
change into the upgrade guide instead, which is where the recombination-lane
removal went.

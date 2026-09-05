---
name: level-row-pair-getter
description: "The level's two rows" is resolved as views[level] / views[level + 1] with slightly different guards in seven places across the pairwise synteny stack; one ungated rowPair getter on the view helper would give the pair-resolution idiom and its "upper = query axis" orientation fact a single home. Low priority, and constrained by the parentViewDuck cycle-cutting — any unification stays on the duck.
---

# One getter for the level's row pair

Not committed work, and deliberately low priority. The pairwise synteny stack
resolves "this level draws between these two rows" in seven spellings:
`assemblyNames` and `bandTransformKey` in
`LinearSyntenyViewHelper/stateModelFactory.ts`, `connectedViews`,
`paintedChromosomeOrder` and `effectiveColorBy` in
`LinearSyntenyDisplay/model.ts`, `axisAssemblies` in its `afterAttach.ts`, and
`offscreenMateStrip.ts`. Each is individually correct, but the idiom — and the
"upper row is the query axis" orientation fact riding on it — has no single
home, which is the shape that historically let an offscreen-mate mark land on
the wrong axis ([offscreen-synteny-mates](offscreen-synteny-mates.md)).

The minimal move: an ungated `rowPair` getter on the helper
(`{ v0, v1 } | undefined`) that `bandTransformKey`, `assemblyNames` and the
strip read; `connectedViews` keeps its own initialization gate on top.
Constraint: the helper reaches its view through `parentViewDuck` to cut an
import cycle, so the getter's types stay on the duck — which is also why this
is parked rather than done, since the duck typing is most of the work for a
modest dedupe.

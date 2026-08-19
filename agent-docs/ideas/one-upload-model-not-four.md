---
name: one-upload-model-not-four
description: The HAL keys every buffer one way and four modules above it spell that key four ways, plus a fifth mechanism inside the HAL and eight displays hand-rolling the attach. ADR-017's premise expired in the direction its own "revisit if" named, and installPerRegionLifecycle.test.ts is a ready-made oracle for the collapse.
---

# One upload model instead of four

`packages/render-core/src/hal/regionRegistry.ts` keys every buffer by
`(regionKey, passId)`. That is the storage model, and there is exactly one of
it. Everything above it is four dialects for saying which of those entries to
rewrite:

| module | lines | keyed by |
| --- | --- | --- |
| `installPerRegionLifecycle.ts` | 180 | region index, via one autorun per key |
| `regionUploadSync.ts` | 59 | region index, via a reference diff |
| `globalUploadSync.ts` | 69 | a slot name |
| `keyedUploadSync.ts` | 84 | a display key |

392 lines. Beside them, eight displays call `attachRenderingBackend` directly
rather than through `GlobalDataDisplayMixin` — alignments, canvas
`LinearBasicDisplay`, hic, LD, dotplot, the synteny level, multi-sample variant,
variant matrix. And `RegionRegistry.retainRegion` is a **fifth**
mechanism, living in the HAL, whose docstring says it exists because the caller
"cannot enumerate the passes it writes". That is the same memo as
`createRegionUploadSync`, one layer down, reached because alignments hands over
a whole-map payload instead of keyed slots.

Take this one **first** of the three render-path simplifications: it is the
smallest, its oracle is already written, and it removes the "which of four
patterns" question from the new-display checklist in `GPU_RENDERING.md`. The
other two are
[absolute-coordinates-for-hic-and-ld](absolute-coordinates-for-hic-and-ld.md)
and [one-mark-declaration-per-feature](one-mark-declaration-per-feature.md).

## ADR-017's premise has expired, and the ADR says so itself

[ADR-017](../architecture-decision-records/adr-017-wiggle-per-key-autoruns.md)
chose per-key autoruns because "the natural shape re-uploads all N entries",
which was true of the naive loop. Canvas has exactly the whole-map computed that
ADR describes as disqualifying, and gets O(1) uploads per arrival anyway,
because `createIncrementalLayout` returns stable references and
`createRegionUploadSync` diffs on them.

The ADR's own "Revisit if" names this trigger — "make `computeLaidOutData`
return stable per-key references" — and it fired in the other direction. So two
mechanisms do one job and the choice between them is historical rather than
technical.

## Declaring the encode's inputs is the half that makes the collapse safe

`encode` becomes `(data, props) => Encoded` with no `self` in scope, and the
helper memoizes `props` once for every key. That is the same collapse
`serializeRpcProps` made on the fetch side — invalidate on what the props
*return*, never on what building them *reads* (`ARCHITECTURE.md`, "the cache key
is the return value, not the reads"). It also turns render-core's `CLAUDE.md`
rule — "an `encode` reads a narrow inputs getter, never the display's
`renderState`" — from prose into something that cannot be written.

Every consumer already has the signature: `buildSourceRenderData(data,
gpuProps)` literally is it, and both wiggle `renderSvg.tsx` files already hoist
`model.gpuProps()` out of the region loop while the on-screen path re-reads it
per region.

## Oracle: it already exists

`installPerRegionLifecycle.test.ts` pins the upload-count contract in ten tests,
of which five are the ones the collapse turns on: O(N) arrivals, encoder-dep
re-fire, per-key mutation, removal, and backend swap on context-loss recovery.
Reimplement the helper on the diff and run that file unchanged. Green means the
two mechanisms are interchangeable and one can go; red names the property that
actually distinguishes them, which is worth knowing either way.

## One incidental defect the same change removes

`installPerRegionLifecycle` allocates two `Map`s and registers an `addDisposer`
*before* calling `attachRenderingBackend`, which returns early once installed.
`useRenderingBackend` calls `startRenderingBackend` again on every context-loss
re-init, so each recovery leaves a dead disposer and two dead maps on the node.
Harmless in size; it is the shape that makes "only the first call's callbacks
survive" invisible at the call site. An `attachRenderingBackend` that takes a
setup thunk invoked once fixes the cause, and retires the warning three helper
docstrings currently repeat.

## Already declined nearby — do not re-derive

- **A scheduler on the render autorun** —
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md#a-region-arrival-draws-twice-wherever-the-render-autorun-observes-the-data),
  A/B'd on real hardware, every column inside baseline spread.
- **Buffer pooling** — the one unclaimed item in `GPU_RENDERING.md`
  §"What this architecture deliberately does not have", correctly blocked on a
  measurement rather than a design.
- **Folding the comparative fetch onto `FetchMixin`** —
  [ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md),
  four independent grounds. This proposal does not touch it.
- **A uniform slot token** — `ARCHITECTURAL_LIMITS.md` §"A uniform write binds
  to its draws by adjacency" already carries the retire-when, gated on a
  renderer wanting two uniform sets alive at once.

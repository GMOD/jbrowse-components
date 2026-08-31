---
name: the-synteny-fetch-key-goes-blind-once-its-window-clamps
description: A synteny fetch emits geometry one pan buffer past the viewport, and its key is a window snapped outward AND clamped to the displayed region — so on a region a few buffers wide the clamp pins the key while the viewport keeps panning, and the trailing strip of the band draws nothing while `dataCurrent` reports true. Three candidate fixes, each with a trade nobody has measured.
---

# The synteny fetch key goes blind once its window clamps

`syntenyPanBufferPx` (`packages/synteny-core/src/syntenyFetchWindow.ts:17`) is
the stated single source of truth for three windows that must agree — the
worker's whole-feature cull, `buildSyntenyGeometry`'s emit cull, and the
main-thread fetch window — and it states the invariant plainly: *"the distance a
pan can travel before the snapped fetch window rolls over is exactly the
distance geometry was emitted for."*

Unclamped that holds, marginally exactly: the outward snap keeps the window
constant over one grid cell of pan, and the emit window is one buffer. The
**clamp** breaks it. Once the snapped window exceeds the displayed region on
both sides, `syntenyFetchRegions` pins it to the region and it stops moving
altogether, so the key stays constant over a pan bounded only by the region.

Worked at ordinary numbers — 1400 px viewport, 100 bp/px, so `bufferPx` is the
2000 px floor and `bufferBp` 200 kb, over a 500 kb displayed region — the
signature is `0-500000` for every viewport start from 61 kb to the region end. A
299 kb pan, ~3000 px, against a 2000 px emit window. A fetch taken at 110 kb
emits for `[0, 450 kb]`; pan to the end and the rightmost 50 kb — 500 px of a
1400 px band — is outside anything the worker emitted, with `currentFetchKey`
unchanged and `dataCurrent` true.

Three symptoms; only the last needs no cooperation between the rows:

- A feature off screen on **both** axes at fetch time was dropped by the
  whole-feature cull (`executeSyntenyFeaturesAndPositions.ts:585-597`) and is
  absent. Both axes have to be off, so this wants the linked or
  synteny-following browse — which is how this view is usually driven.
- CIGAR detail and location markers are culled on the same window
  (`buildSyntenyGeometry.ts:656-670`, marker hull at `:606-620`), so a ribbon
  can be a bare trapezoid with its indels and ticks stopping partway along.
- A block `clipLargeBlockToWindow` re-anchored to the viewport
  (`executeSyntenyFeaturesAndPositions.ts:431-444`) carries only its visible
  slice, so its ribbon **visibly truncates** at the window edge the fetch was
  taken at.

The regime is a displayed region between roughly one viewport and one viewport
plus four buffers at the current zoom. Wider regions keep the snap's
sensitivity; narrower ones are covered whole by the first fetch. `overdrawPx` is
not this bug: it is capped at `PAN_BUFFER_PX`, and because `isRibbonCulled` is
per-edge (`syntenyRibbonPath.ts:354-357`) a worker-culled feature can only
re-enter the off-canvas margin before the key rolls, never the visible band.

## Why it is parked rather than fixed

There is no cheap correct fix — widening the emit pad by a constant only narrows
the regime, because the clamped key is insensitive over a pan bounded by the
region rather than by buffers. The three that work each trade something on the
hot path, and choosing wants a measurement:

- **Emit the whole fetch window** instead of viewport ± buffer. Correct by
  construction — the two windows become one — and bounded, since the fetch
  window is at most viewport + 4 buffers. Costs up to ~2x the emitted geometry
  everywhere, including whole-genome zoom where instance count is already the
  problem.
- **Signature off the UNCLAMPED snapped bounds**, request still clamped. Small
  and local to `syntenyFetchRegions`/`fetchWindowSignature`, no worker change,
  cannot regress rendering. Costs refetches in the clamped regime that are free
  today — against a warm adapter, but `syntenyFetchWindow.ts:43-46` records the
  no-pan-refetch behaviour there as deliberate, for small-region synteny and the
  whole-genome dotplot, which share this function.
- **Cull against the fetch window in bp** rather than viewport ± buffer in px.
  The worker already receives it. Needs the target axis's window even when it is
  not queried — which `LinearSyntenyDisplay.targetWindowRegions` now separates
  out — and turns two symmetric px pads into per-axis asymmetric bp bounds.

## The check that would have caught it

A synteny-core property test over the invariant the comment already states: for
any viewport whose `fetchWindowSignature` matches the fetch's, the viewport is
contained in that fetch's emit window. Pure functions of
`(width, bpPerPx, region length, viewport start)`, no worker needed.

Same class as `agent-docs/reference/SYNTENY_LOD.md`'s recorded bug — a decision
made where the fetch key cannot see it.

---
name: stop-rewriting-the-workers-arrays-to-lay-out-features
description: count the consumers — they decide if it is worth it
metadata:
  area: canvas
  category: measure-first
---

# Stop rewriting the worker's arrays to lay out features

`cloneMutableFields` (`plugins/canvas/src/LinearBasicDisplay/layout.ts`) is **~78%
of a full layout** — 116ms of 148ms at 4k features, per-phase instrumented, against
8.8ms for the actual packing. It is pure allocation: a fresh `Float32Array` per
geometry channel plus an object spread per `flatbushItems` entry, per
`subfeatureInfos` entry and per `floatingLabelsData` entry, all so
`computeLaidOutData` can add each feature's row offset into the copy in place.

**That 78% is a 4k-feature number and does not survive density.** A DevTools trace
of a dense VCF plus a RepeatMasker track (~60k features in view, everything
density-collapsed to row 0) puts `cloneMutableFields` at 73ms of a 724ms committed
layout — **15%, not 78%** — behind `prepareRefPack` (82ms) and
`applyLayoutToRegion` (82ms), with `pileupFadeIds` (47ms) and `applyHeightScale`
(51ms) close behind. The clone is no longer the thing to attack first at that
density; the shared cause underneath all of them is below.

`createContentHeightProbe` packs straight from the raw worker data and never
clones, so the fit solve's height probes escape the cost. Every *committed*
layout pays it: each settled zoom, each pan into new data, each label or
display-mode toggle.

The shape of the fix is to not rewrite the arrays at all — keep the per-feature row
offset in its own `Float32Array` beside the raw result and add it where Y is
consumed. Layout then becomes "compute a row map", i.e. the 8.8ms part.

**Measure the consumers before building it**, because they are the cost, not the
layout. `GpuCanvasFeatureRenderer` already takes per-instance Y so an offset
attribute is cheap there, but `components/hitTesting.ts`,
`components/overlayElements.tsx` (`useOverlayElements.tsx` until `e148172a5e`
made its pseudo-hooks the observer components `FloatingLabelsLayer` and
`HighlightLayer`), `yMorph.ts` (`interpolateYData`, `captureFeatureTops`) and
`scaleLaidOutData` all read absolute `topPx`/`bottomPx`/`rectYs` today.
`renderSvg.tsx` no longer does — it hands `laidOutDataMap` to the Canvas2D
helpers — so the census is one consumer shorter than this entry counted. Count
those call sites first and decide whether they can share one "resolve Y"
accessor, or whether enough of them need the offset folded in that the clone
comes straight back — that answer decides whether the spike is worth it at all.

Two cheaper fallbacks if that is too invasive. `flatbushItems` and
`subfeatureInfos` are arrays of objects cloned by spread, so parallel typed
arrays would remove most of the allocation without touching the render contract.
And `rectDensityFade` is worker-allocated but layout-valued, with
`applyLayoutToRegion` writing every element, so `computeLaidOutData` could
allocate it rather than copy it — the catch being that `cloneMutableFields` is
shared with `scaleLaidOutData`, which does not rewrite the array and still needs
the copy, so that split costs a per-caller flag or a second clone helper.

## The shared cause is that per-feature identity is a string

Every function in that list associates data per feature through a
`Map<string, _>`, a `Set<string>` or a `Record<string, _>`, and at ~60k features
the keying is most of the cost rather than the work. Measured standalone at
N=60k, against the index-keyed equivalent:

| site | now | index-keyed | |
| --- | --- | --- | --- |
| `applyLayoutToRegion`'s `densityFadeIds.has(featureId)` per rect | 12.1ms | 0.10ms | 121x |
| `prepareRefPack`'s two `Map<string, object>` | 90.7ms | 8.2ms | 11x |
| `layoutMap.get(featureId)` offset/height gathers | 6.6ms | 0.22ms | 30x |

Numeric feature ids were floated as the fix and are the wrong lever: at the same
N, `Set<number>.has` is 20.7ms against `Set<string>.has`'s 31.8ms, while
`Uint8Array[idx]` is 1.05ms. Numeric ids buy ~35% of a 30x win and cost a change
to `feature.id()` across every plugin surface. **The index already exists** —
`rectFeatureIndices` / `lineFeatureIndices` / `arrowFeatureIndices` index into
`flatbushItems` — so the per-feature arrays can be keyed by it without touching
the `Feature` ABI at all.

`plugins/alignments` already works this way and is the pattern to copy:
`readChainIndices`, `segmentReadIndices` and `overlapPositions` are `Uint32Array`
indices into parallel arrays, with no string id in the layout path
(`collapsedLayout.ts`, `computeChainLayout.ts`).

Landed so far (commit "perf(canvas): the label map is a Map"): `floatingLabelsData`
is a `Map`, and the label overlay skips its walk outright via a worker-baked
`labelKinds`. Still open, in value order: `prepareRefPack`'s two maps, then
`applyLayoutToRegion`'s fade/offset/height gathers, which need
`packPreparedRef`'s `CollapsedMark` to carry an index rather than an id.

### `pileupFadeIds` is fast to fix and needs a figure re-checked first

A pixel difference array over integer columns replaces the `flatMap` of 2N event
objects and the comparator sort: **45.9ms to 6.1ms at N=60k**, O(N+W), with a
symmetric difference of 0 against the current implementation on a uniform
sub-pixel input.

It is not a pure speedup, which is why it is parked rather than done. The current
sweep works in continuous px and half-open spans that merely touch do not share a
point; quantizing to pixel columns makes two marks inside one column read as depth
2. That is arguably what the function means — the comment argues occlusion is
"measured in painted pixels" — but `PILEUP_FADE_DEPTH`'s threshold of 3 is
calibrated against `website/scripts/specs/graph-hprc.ts`'s `repeatLane`, where the
recorded result is "at 3 nothing on screen fades, at any pane width the figure is
captured at". Re-capture that figure before taking the 7.5x.

## `featureItemMap` is the same allocation, in the same file

Take it in the same pass; it was a separate entry until 2026-08-13 and each one
said to pair it with the other, which is the tell. `baseModel.ts`'s
`featureItemMap` allocates one entry object per feature AND per subfeature across
every visible region, on every layout change, pan or zoom. Its consumers ask very
little of it: `HighlightLayer` does a handful of `.get()`s (and genuinely needs
`entry.vr` / `entry.data`), while `FloatingLabelsLayer` asks twice — the
`?.kind === 'feature'` check at `components/overlayElements.tsx:467`, which
decides whether a label is clickable, and `resolveTarget` at `:521-531`.

Only the first of the two is removable. `emitSubfeatureLabel` always sets
`parentFeatureId` and `processFeatureRecord` never does, so
`clickable === (labelData.parentFeatureId === undefined)` with no map at all.
`resolveTarget` is not that: it returns `entry.item` to the click, context-menu
and mousemove handlers, which a `parentFeatureId` cannot supply, and it predates
this entry (`8a3a06cbb8`) — the claim that the second consumer went outright was
wrong on arrival.

So the map stays and what is open is what it costs: replace it with an on-demand
region scan or a lazily-populated per-id cache, and fold in `baseModel.ts`'s
`featureIdIndex` / `subfeatureIdIndex` (`:1678-1687`), which build two
neighbouring id indexes the same way.

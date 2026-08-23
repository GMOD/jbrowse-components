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

---
name: stop-rewriting-the-workers-arrays-to-lay-out-features
description: the lanes are not the cost — the objects are, on both sides of the hop
metadata:
  area: canvas
  category: measure-first
---

# Stop rewriting the worker's arrays to lay out features

`computeLaidOutData` (`plugins/canvas/src/LinearBasicDisplay/layout.ts`) clones
each region before it can add the per-feature row offset into it, because
`applyHeightScale` and `applyLayoutToRegion` both mutate. This entry used to
propose keeping the row offset in a `Float32Array` beside the raw result and
adding it where Y is consumed, so the clone could go.

**That was measured and it is the wrong lever.** Numbers below are one region,
node/jest on an M-series laptop (so absolute values run high; the ratios are the
point), a labeled fixture where every feature carries a name.

| | 4k features | 60k features |
| --- | --- | --- |
| `computeLaidOutData` total | 35.0ms | 686ms |
| the pack alone (`createContentHeightProbe`, no clone) | 30.6ms | 474ms |
| clone + `applyHeightScale` + `applyLayoutToRegion` | **4.4ms (12%)** | **213ms (31%)** |

The 78%-at-4k figure this entry used to lead with does not reproduce; at that
size the pack — label reservation plus `GranularRectLayout` — is nearly all of
it.

Inside that 213ms, at N=60k:

| | |
| --- | --- |
| `floatingLabelsData` Map clone (an object spread per entry) | 128.5ms |
| `flatbushItems.map({...})` | 30.2ms |
| `subfeatureInfos.map({...})` | 28.1ms |
| `layoutMap.get(featureId)` per feature | 23.7ms |
| the label walk's own `.get` per entry | 18.5ms |
| **every Float32Array lane, cloned AND rewritten** | **~0.6ms each** |

So the typed-array lanes the row-offset spike targets are about **2% of the
clone**. Standalone, over 60k elements: clone-and-bake `y*m + rows*f + off[idx]`
is 0.64ms; resolving the same expression in a consumer's own loop is 0.44ms.
Moving 0.6ms out of layout and into eight consumers — the GPU packer, the
Canvas2D painter, `hitTesting`, `overlayElements`, `yMorph`, `maxBottom`,
`minDrawnBoxHeight`, `renderSvg` — is not a trade worth making, and it is the
trade this entry always warned would come straight back. **Don't build the row
offset.**

## What the numbers do say to build

**Struct-of-arrays for `flatbushItems` / `subfeatureInfos`.** The measurement
that decides it is the worker→main hop, not the clone:

| structured clone of, at N=60k | |
| --- | --- |
| `{flatbushItems, subfeatureInfos}` — 120k objects | **365ms** |
| the same content as parallel typed arrays + two `string[]` | **~30ms** |

Structured clone charges by object count; the strings are cheap (60k of them
clone in 28ms) and the typed arrays are transferable. That is a 12x cut on a
cost every fetch pays, half of it on the main thread. It also removes the 58ms
of per-object spreads above and makes the layout gathers index-keyed for free —
`rectFeatureIndices` already indexes `flatbushItems`, so no `Feature` ABI change
is involved (the numeric-feature-id idea was and remains the wrong lever: at
N=60k `Set<number>.has` is 20.7ms against `Set<string>.has`'s 31.8ms, while
`Uint8Array[idx]` is 1.05ms).

The cost is the churn: `FlatbushItem` and `SubfeatureInfo` are read by the hover
readout, the context menu, the highlight resolver, the label layer, `renderSvg`,
`featureItemMap`, `hitTesting`, `layout`, and the LD display — about 30 source
files and 25 test files — and `FlatbushItem` is exported from
`plugins/canvas/src/index.ts`, so it is a plugin-ABI change too
(`reference/PLUGIN_ABI_STABILITY.md`). A half-landed conversion is worse than
either end, so this wants a session of its own.

**A cheaper first move, if that is too wide:** keep the object shape in memory
and make only the WIRE format SoA — pack in `executeRenderFeatureData`, rehydrate
in `setRpcData`. Rehydration costs about what the spread costs (~30ms at 60k), so
365ms becomes ~60ms with no consumer touched at all. It is a shim by the
"delete rather than shim" rule, but it buys 6x for two files.

**`floatingLabelsData`'s 128ms is a labeled-60k number and is mostly not real.**
At that density labels are decimated or off, so the map is small — which is why
a DevTools trace of a dense VCF + RepeatMasker put the whole clone at 15% rather
than 31%. Attack it only behind a trace that shows it.

## Still open, unchanged by the above

`createContentHeightProbe` packs straight from the raw worker data and never
clones, so the fit solve's height probes escape all of this. Every *committed*
layout pays it: each settled zoom, each pan into new data, each label or
display-mode toggle.

### The consumers are their own cost

Measured over the same fixture at N=60k, per committed layout:
`buildFeatureFlatbushIndex` 168ms, `buildSubfeatureFlatbushIndex` 169ms,
`interpolateYData` 41ms. Each is comparable to the entire clone, and the two
Flatbush builds run on every layout because `CanvasHitIndexes` keeps them
observed. Whether a region's subfeature index can be built lazily — nothing
reads it until a hover — is a separate and probably larger win than anything
above.

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

### `featureItemMap` is the same allocation, in the same file

Take it in the same pass as the SoA conversion; it is the same shape of problem.
`baseModel.ts`'s `featureItemMap` allocates one entry object per feature AND per
subfeature across every visible region, on every layout change, pan or zoom. Its
consumers ask very little of it: `HighlightLayer` does a handful of `.get()`s
(and genuinely needs `entry.vr` / `entry.data`), while `FloatingLabelsLayer` asks
twice — the `?.kind === 'feature'` check at `components/overlayElements.tsx`,
which decides whether a label is clickable, and `resolveTarget`.

Only the first of the two is removable. `emitSubfeatureLabel` always sets
`parentFeatureId` and `processFeatureRecord` never does, so
`clickable === (labelData.parentFeatureId === undefined)` with no map at all.
`resolveTarget` is not that: it returns `entry.item` to the click, context-menu
and mousemove handlers, which a `parentFeatureId` cannot supply.

So the map stays and what is open is what it costs: replace it with an on-demand
region scan or a lazily-populated per-id cache, and fold in `baseModel.ts`'s
`featureIdIndex` / `subfeatureIdIndex`, which build two neighbouring id indexes
the same way.

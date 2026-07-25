---
name: todo
description: Action items to build or fix, the current backlog. Read when picking up work.
---

## Fold the non-LGV fetches onto `FetchMixin`

Multi-LGV synteny and dotplot hand-roll the fetch state machine in ~480 lines of
`afterAttach.ts` plus per-model volatiles, sharing only `createStopTokenRotation`
(token mechanics) with each other. Freshness and export readiness are now shared
(`dataCurrent` / `computeSvgReady`), and the progress throttle is shared
(`createStatusThrottle`), so what remains genuinely duplicated is the state
machine: a raw token volatile each, their own `loading`/`refetching` derivations,
no `fetchCanceled`/`cancelFetchByUser`, no `reload()`. Synteny also still uses a
plain `{ delay: 500 }` where dotplot and `installGlobalFetchAutorun` leading-edge,
so its first fetch waits out the full debounce with nothing to coalesce.

The shape: a `SignatureFetchMixin` = `FetchMixin` + `loadedFetchKey` volatile +
overridable `currentFetchKey` + `dataCurrent`, plus an
`installSignatureFetchAutorun` skeleton modeled on `installGlobalFetchAutorun`.
That makes the display-stacks table in
[ARCHITECTURE.md](ARCHITECTURE.md#display-stacks) three rows that all compose
`FetchMixin`, instead of two rows and a footnote.

**Read `@jbrowse/synteny-core`'s `SyntenyFetchStateMixin` first** — it landed
2026-07 and already shares `fetching` / `loadedFetchKey` / `assembliesSwapped`
between the two displays. Decide whether this is that mixin growing into
`FetchMixin` or a separate move before starting.

## Alignments / canvas

- Group by strand, `plugins/canvas`. Nothing in `plugins/canvas` groups today;
  the vocabulary to copy is `plugins/alignments/src/shared/groupFeatures.ts`
  (`GROUP_BY_DIMENSIONS`, section dividers).
- Sample/library (SM/LB) grouping. `RG` already works via the generic tag
  dimension, but SM/LB live in the header's `@RG` lines, not in the record, so
  this needs an RG→SM/LB map from the adapter.
- Separate quantitative splice-junction track. Sashimi exists only as an overlay
  (`plugins/alignments/src/features/sashimi`).
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`. This is a re-add:
  the old `showTooltips` prop was dropped in the rewrite (see the legacy-props
  comment in `shared/MultiSampleVariantBaseModel.ts`).
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and
  similar displays). `plugins/canvas` already has `hideFeature`
  (`LinearBasicDisplay/baseModel.ts`) to copy.

## Stop rewriting the worker's arrays to lay out features

`cloneMutableFields` (`plugins/canvas/src/LinearBasicDisplay/layout.ts`) is **~78%
of a full layout** — 116ms of 148ms at 4k features, per-phase instrumented, against
8.8ms for the actual packing. It is pure allocation: a fresh `Float32Array` per
geometry channel plus an object spread per `flatbushItems` entry, per
`subfeatureInfos` entry and per `floatingLabelsData` entry, all so
`computeLaidOutData` can add each feature's row offset into the copy in place.

The fit solve's height probes already skip it — `createContentHeightProbe` packs
straight from the raw worker data and never clones, which is what took the
`decimated` rung's solve from 6.1 layouts to 1.4. Every *committed* layout still
pays it: each settled zoom, each pan into new data, each label or display-mode
toggle.

The shape of the fix is to not rewrite the arrays at all — keep the per-feature row
offset in its own `Float32Array` beside the raw result and add it where Y is
consumed. Layout then becomes "compute a row map", i.e. the 8.8ms part.

**Measure the consumers before building it**, because they are the cost, not the
layout. `GpuCanvasFeatureRenderer` already takes per-instance Y so an offset
attribute is cheap there, but `components/hitTesting.ts`,
`components/useOverlayElements.tsx`, `renderSvg.tsx`, `yMorph.ts`
(`interpolateYData`, `captureFeatureTops`) and `scaleLaidOutData` all read absolute
`topPx`/`bottomPx`/`rectYs` today. Count those call sites first and decide whether
they can share one "resolve Y" accessor, or whether enough of them need the offset
folded in that the clone comes straight back — that answer decides whether the
spike is worth it at all.

Cheaper fallback if it is too invasive: `flatbushItems` and `subfeatureInfos` are
arrays of objects cloned by spread, and parallel typed arrays would remove most of
the allocation without touching the render contract.

Smaller and already unblocked: `rectDensityFade` is worker-allocated but
layout-valued, and `applyLayoutToRegion` writes every element, so the
`computeLaidOutData` path could allocate it rather than copy it. Note
`cloneMutableFields` is shared with `scaleLaidOutData`, which does NOT rewrite the
array and so still needs the copy. Splitting that means a per-caller flag or two
clone helpers, which is why it was left alone.

## Stop uploading every rect twice for the continuation pass

`GpuCanvasFeatureRenderer.uploadRegion` packs `numRects` continuation instances
alongside `numRects` rect instances, so the densest tracks pay double the rect
upload and VRAM to draw at most a handful of screen-edge markers. The two instance
structs are already byte-identical (`uint2 startEnd; float y; float height; uint
color;` plus a differing 4-byte `ATTR4`: `uint densityFade` on rect, `float strand`
on continuation).

`makeChevronPass` is the worked precedent for the fix: chevron owns no buffer and
draws off line's via `drawPass(chevron, region, bufferPassId=line)`, wired by
passing line's `bufferStride`/`bufferAttributes`. Unify `ATTR4` (bit-pack strand
into the same word, or widen both structs to one shared stride) and continuation
can do the same off rect.

Not attempted yet because it needs `.slang` edits plus `pnpm gen:shaders`, and a
wrong attribute offset shows up as garbled geometry that no unit test catches.
Verify headed on a real GPU against both backends, since WebGL2 binds attributes
through `vertexAttribPointer`/`vertexAttribIPointer` (int vs float matters) while
WebGPU goes through `vertex.buffers`.

The cheap half is already done: `drawRegion` skips the continuation pass entirely
on a block touching neither canvas edge, where every instance would self-cull.

## `featureItemMap` is an O(N) build serving a handful of point queries

`baseModel.ts`'s `featureItemMap` allocates one entry object per feature AND per
subfeature across every visible region, on every layout change, pan, or zoom. Its
consumers ask very little of it: `useHighlightOverlays` does a handful of `.get()`s
(and genuinely needs `entry.vr` / `entry.data`), while `useFloatingLabels` uses it
only for `?.kind === 'feature'` to decide whether a label is clickable.

That second consumer is removable outright. `emitSubfeatureLabel` always sets
`parentFeatureId` and `processFeatureRecord` never does, so
`clickable === (labelData.parentFeatureId === undefined)` with no map at all.

With it gone the map is built for roughly five lookups, so replace it with an
on-demand region scan or a lazily-populated per-id cache. Worth pairing with the
`cloneMutableFields` item above, since both are per-layout allocation over the same
arrays.

## Measure the WebGL2 context budget in the shape users actually hit

The context ceiling in
[reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md) §"One
WebGL2 context per display canvas" has only ever been measured with a synthetic
24-view harness (since deleted). One view holding 10 to 20 GPU tracks reaches the
same context count and is an ordinary session, and nobody has run it. The number
decides whether track-level mount/release is worth building or whether the
Canvas2D-after-K-losses backstop is enough, so measure before building either.

Home is `browser-tests/suites/gpu-quirks.ts`, beside its existing "recovers from
WebGL context loss" test. Every piece exists: `navigateWithSessionSpec` takes one
LGV with an arbitrary `tracks` array, `test_data/volvox/config.json` carries 124
tracks, `WebGL2Hal` logs `init (live=N/total)` and `context LOST` under
`?webgl2-debug=1`, and `runner.ts` has a `page.on('console')` hook to collect
them. Walk N up, record where an **unforced** `context LOST` first appears and
whether recovery settles or cascades.

Report a diagnostic number first. Only then consider a regression assertion, well
under the observed threshold (a "12 tracks lose no context" floor) so it doesn't
flake.

**The number from CI is a floor, not the answer.** Headless always falls back to
SwiftShader ([guides/TEST_INFRASTRUCTURE.md](guides/TEST_INFRASTRUCTURE.md)), whose
context cap need not match a real driver's, so the run that characterizes the
limit is headed on a real GPU. Worth capturing both and noting which is which.

## Extra large text SVG mode for pub-ready figures

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.

## Autofit height for the lineargenomeview example-site demo

No view-level auto-height in `products/jbrowse-react-linear-genome-view`; only
per-track `heightMode` grow/fit (demoed in `examples-site` `WithTrackSizing`).

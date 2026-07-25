---
name: todo
description: Action items to build or fix, the current backlog. Read when picking up work.
---

## Alignments / canvas

- Group by strand, `plugins/canvas`. Nothing in `plugins/canvas` groups today;
  the vocabulary to copy is `plugins/alignments/src/shared/groupFeatures.ts`
  (`GROUP_BY_DIMENSIONS`, section dividers).
- Sample/library (SM/LB) grouping. `RG` already works via the generic tag
  dimension, but SM/LB live in the header's `@RG` lines, not in the record, so
  this needs an RG→SM/LB map from the adapter.
- Separate quantitative splice-junction track. Sashimi exists only as an overlay
  (`plugins/alignments/src/features/sashimi`).
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and
  similar displays). `plugins/canvas` already has `hideFeature`
  (`LinearBasicDisplay/baseModel.ts`) to copy.

## Re-measure the per-region double draw

`renderBlocks` now reports whether it painted and the `rpcDataMap.size`
predicates are gone from the per-region render callbacks (the work item that
used to live here). What was *not* redone is the measurement that motivated it:
[reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md)
§"Every region arrival draws twice" recorded 4 regions arriving in separate
actions producing 4 uploads and **8** renders, and that count is now unknown
rather than known-fixed.

Rerun it against `RenderLifecycleMixin` + `installPerRegionLifecycle` with a
display that no longer reads the data map (wiggle or Manhattan), counting upload
and render callback invocations. 4/4 retires the entry; anything else says
`renderTick` is not the single redraw channel and the reasoning in that entry is
wrong. Note `LinearAlignmentsDisplay` deliberately still observes `rpcDataMap`
(zero-group grouped fetch), so it is not the display to measure.

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

## Measure the WebGL2 context budget in the shape users actually hit

The context ceiling in
[reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md) §"One
WebGL2 context per display canvas" has only ever been measured with a synthetic
24-view harness (since deleted). One view holding 10 to 20 GPU tracks reaches the
same context count and is an ordinary session, and nobody has run it. The number
decides whether track-level mount/release is worth building or whether the
Canvas2D-after-K-losses backstop is enough, so measure before building either.

Home is `browser-tests/suites/gpu-quirks.ts`, as a sibling to its existing
"recovers from WebGL context loss" test. Every piece already exists:
`navigateWithSessionSpec` takes one LGV with an arbitrary `tracks` array,
`test_data/volvox/config.json` carries 124 tracks so N is not the constraint,
`WebGL2Hal` logs `init (live=N/total)` and `context LOST` under `?webgl2-debug=1`,
and `runner.ts` already has a `page.on('console')` hook to collect them. Walk N up
and record where an **unforced** `context LOST` first appears, and whether recovery
settles or cascades.

Report a diagnostic number first. Only then consider a regression assertion, and
put it well under the observed threshold (a "12 tracks lose no context" style
floor) so it doesn't become a flake.

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

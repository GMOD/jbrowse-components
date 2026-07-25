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

## Make `renderBlocks` return whether anything painted

The work item behind the "Did we paint?" entry in
[reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md), which has
the diagnosis. It retires a **second** entry there, "Every region arrival draws
twice": `rpcDataMap.size` in the render callback is the only reason the render
autorun observes the data map, so deleting these predicates leaves `renderTick`
as the single redraw channel and the pre-upload draw goes with it.

Per-display audit of the predicate each model hand-writes today:

| Display | Predicate ahead of `return true` |
| --- | --- |
| `LinearBasicDisplay` (`plugins/canvas`) | `renderDataMap.size === 0` |
| `LinearManhattanDisplay` | `rpcDataMap.size === 0` |
| wiggle / multi-wiggle | `rpcDataMap.size === 0` |
| `LinearReferenceSequenceDisplay` | `zoomedOut` |
| `LinearMafDisplay` | `!renderState` only |
| `LinearMultiRowFeatureDisplay` | none |
| `LinearMultiSampleVariantDisplay` | none |
| `LinearAlignmentsDisplay` | forwards its own backend's boolean (the shape to copy) |

Open question to settle first: `GpuPerRegionRenderingBackend.renderBlocks` can
answer exactly ("a `drawRegion` ran"), but `Canvas2DPerRegionRenderingBackend`
delegates clipping to the plugin's `drawXxxBlocks`, so it can only answer "some
block had region data" without re-running `clipBlockForCanvas` purely for the
predicate. Decide whether that asymmetry is acceptable or whether `draw` should
also return the boolean.

Getting a predicate wrong strands a display on the loading scrim and unit tests
won't catch it, so land it behind the browser differential run
(`products/jbrowse-web/browser-tests/compare-backends.ts`).

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

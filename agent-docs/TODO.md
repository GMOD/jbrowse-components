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
the diagnosis. Per-display audit of the predicate each model hand-writes today:

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

## Extra large text SVG mode for pub-ready figures

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.

## Autofit height for the lineargenomeview example-site demo

No view-level auto-height in `products/jbrowse-react-linear-genome-view`; only
per-track `heightMode` grow/fit (demoed in `examples-site` `WithTrackSizing`).

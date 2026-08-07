---
title: Custom track and display types
description:
  Define track types (high-level identity) and display types (how a track
  renders in a given view)
guide_category: Plugins
sidebar_label: Tracks and displays
---

**TL;DR:** to add a new way to visualize data in an existing view, write a
display type, not a track type.

A track owns the high-level identity (an ID, a name, a default set of displays);
a display shows that track inside a particular view and owns the drawing.

```
Track  ─owns→  Display(s)  ─draw→  canvas
```

Tracks are deliberately thin. For example:

- `AlignmentsTrack` owns `LinearAlignmentsDisplay`, which internally combines a
  pileup row and an SNP-coverage row, both ways of looking at BAM/CRAM data
  inside a `LinearGenomeView`.
- `VariantTrack` owns `LinearVariantDisplay` (registered against
  `LinearGenomeView`) and `ChordVariantDisplay` (registered against
  `CircularView` by the `circular-view` plugin). The track is the same; the
  displays are different because the views are different.
- `SyntenyTrack` owns `DotplotDisplay` and `LinearSyntenyDisplay`, letting the
  same underlying PIF/PAF data render in either a `DotplotView` or a
  `LinearSyntenyView`.

Add a track type only when you need a new conceptual track category, a custom
config schema for that category, or behavior shared across multiple displays.

## Registering a track type

Track types are registered with `pluginManager.addTrackType(...)` and reuse the
base track config schema. The
[pluggable elements](/docs/developer_guides/pluggable_elements) reference lists
the full set of slots. Useful in-tree references:

- `plugins/alignments/src/AlignmentsTrack` - multi-display track
- `plugins/variants/src/VariantTrack` - track shared across view types
- `plugins/hic/src/HicTrack` - track with a single dedicated display

## When to add a custom display type

- Drawing chrome over the rendered content (e.g. the Y-scale axis in wiggle
  tracks, soft-clip indicators in alignments)
- Adding track-menu items that toggle display-only state (e.g. "Show soft
  clipping", "Modifications")
- Wiring a [custom widget](/docs/developer_guides/creating_widget) into feature
  clicks (e.g. `VariantFeatureWidget`)
- Bundling a specific adapter with drawing code tuned for it, so users get the
  right combination by default instead of relying on the generic `FeatureTrack`
  / `LinearBasicDisplay`

The display owns view-specific state, menu items, overlays, and the drawing
itself. The rendering backend it instantiates is a plain class it constructs
directly, not something registered with the plugin manager.

## Display foundations

Linear-genome-view displays are built from a small set of **foundation mixins**
composed on `BaseDisplay`, all sharing `baseLinearDisplayConfigSchema` as their
config base. Which foundation you compose is the primary axis of code sharing;
_how_ you render (GPU or Canvas2D) is a separate axis layered on top. Two fetch
foundations cover every in-tree display:

<!-- DISPLAY_FOUNDATIONS START -->

<!-- prettier-ignore -->
| Foundation | Brings | Used by |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | Per-region fetch + render: the fetch autoruns, `rpcProps()` refetch wiring, and byte gating. The common case. | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `LinearReferenceSequenceDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `GlobalDataDisplayMixin()` | One non-regional dataset with no per-region partitioning, plus the GPU render lifecycle. Installs no fetch autoruns; the display adds its own via `installGlobalFetchAutorun`. | `LinearHicDisplay`, `SharedLDModel` |
| `GlobalFetchMixin()` | The same single-global fetch foundation without the render lifecycle, so a non-GPU display that paints main-thread SVG does not drag it in. | `LinearArcDisplay`, `LinearPairedArcDisplay` |

<!-- DISPLAY_FOUNDATIONS END -->

Both walkthroughs, [Canvas2D](/docs/developer_guides/plotting_features) and
[GPU](/docs/developer_guides/creating_gpu_display), use
`MultiRegionDisplayMixin`, the common case. New track types should compose one
of these rather than emitting SVG per feature.

## Cross-cutting mixins

A foundation answers how your display _fetches_. These answer everything else,
and they are orthogonal to it — compose any of them on top of whichever
foundation you picked. Each is one mixin with one overridable hook, and
composing it **is** the opt-in: a display that never overrides the hook gets the
default and pays nothing.

Reach for one of these before writing the behavior yourself. Each replaced
several hand-written copies that had already drifted from each other — four
spellings of the scroll clamp, two of grow mode — and the **Composed by** column
is read off the `types.compose(...)` calls themselves, so it is also the honest
answer to "does anything else already do this?"

<!-- CROSS_CUTTING_MIXINS START -->

<!-- prettier-ignore -->
| Mixin | The display supplies | Composed by |
| --- | --- | --- |
| `TrackHeightMixin()` | Internal vertical scroll. `scrollableHeight` (default `Infinity` = doesn't scroll). Brings the clamped `setScrollTop` and the autorun that re-clamps when content shrinks | `LinearAlignmentsDisplay`, `LinearArcDisplay`, `LinearCanvasBaseDisplay`, `LinearHicDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `LinearPairedArcDisplay`, `LinearReferenceSequenceDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `SharedLDModel` |
| `TreeSidebarMixin()` | Row set with a dendrogram sidebar. `sources` (the display rows, named), plus the `run` callback naming its own clustering RPC. Brings `layout` / `clusterTree` / `clusterProvenance` / `treeAreaWidth` / `subtreeFilter`, the `runClustering` / `clusterRegion` declarative launch pair `setupRunClusteringAutorun` consumes, the `root` and `willClearTree` getters, and the tree-hover and canvas-ref volatiles the shared sidebar draws through | `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `HeightModeMixin()` | Track-height strategy; the one row that must compose **after** `TrackHeightMixin()`, whose `height` and `resizeHeight` it overrides. `growTargetHeight` (default = the raw slot). Brings `heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive `height` override, `setHeightMode`, and the grow-aware `resizeHeight` | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay` |
| `ScoreScaleMixin()` | Score axis. Nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `*Bound` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume | `LinearAlignmentsDisplay`, `WiggleScoreConfigMixin` |
| `StaleViewportRescaleMixin()` | Stale-pixel rescaling for a display whose worker output is in fetch-time pixel space. Nothing — the display records `lastDrawnOffsetPx`/`lastDrawnBpPerPx` from its render callback. Brings the `renderTransform` that keeps stale pixels aligned during a pan-during-fetch and the `viewportFresh` half of `dataCurrent` | `LinearHicDisplay`, `SharedLDModel` |

<!-- CROSS_CUTTING_MIXINS END -->

`HeightModeMixin()` is the one with an ordering rule: compose it **after**
`TrackHeightMixin()`, whose `height` and `resizeHeight` it overrides.
`types.compose` gives a collision to the later argument, so the wrong order
silently leaves grow mode inert — the mixin reports it at attach rather than
letting you find out visually.

The
[architecture spec's display-stacks table](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#display-stacks)
is the canonical version of this table and goes further into why the fetch and
render foundations are split.

## Pairing displays with tracks and views

A display registers itself as compatible with one view type. For example
`LinearVariantDisplay` is registered against `LinearGenomeView`, while
`ChordVariantDisplay` is registered against `CircularView`. Both belong to the
same `VariantTrack`.

## Walkthroughs

Two end-to-end guides build the same display, differing only in the renderer.
Start with the first:

- [](/docs/developer_guides/plotting_features) - fetch in a worker, draw with
  Canvas2D. Right for gene-scale tracks, and no shaders involved.
- [](/docs/developer_guides/creating_gpu_display) - the same display with a
  `.slang` shader behind it, for roughly ≳100K features per frame.

Both are build-step plugins; [](/docs/developer_guides/simple_plugin) covers the
scaffold and build setup they assume.

In-tree references:

- `plugins/wiggle/src/LinearWiggleDisplay` - adds a Y-scale overlay on top of
  the rendered content
- `plugins/alignments/src/LinearAlignmentsDisplay` - rich display with many
  toggleable menu items and a custom feature widget
- `plugins/variants/src/LinearVariantDisplay` and
  `plugins/circular-view/src/ChordVariantDisplay` - two displays for one track
  type, in different view types

## See also

- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/svg_export)

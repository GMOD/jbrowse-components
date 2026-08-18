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

Tracks are deliberately thin. Every in-tree registration, with the axis that
makes them thin in the last column — `SyntenyTrack` and `VariantTrack` are the
two that reach past `LinearGenomeView`:

<!-- DISPLAY_VIEW_TYPES START -->

<!-- prettier-ignore -->
| Track type | Display type | Renders in |
| --- | --- | --- |
| [](/docs/config/alignmentstrack) | [](/docs/config/linearalignmentsdisplay) | LinearGenomeView |
| [](/docs/config/featuretrack) | [](/docs/config/lineararcdisplay) | LinearGenomeView |
|  | [](/docs/config/linearbasicdisplay) | LinearGenomeView |
|  | [](/docs/config/linearmultirowfeaturedisplay) | LinearGenomeView |
|  | [](/docs/config/linearscoredisplay) | LinearGenomeView |
| [](/docs/config/gccontenttrack) | [](/docs/config/lineargccontenttrackdisplay) | LinearGenomeView |
| [](/docs/config/gwastrack) | [](/docs/config/linearmanhattandisplay) | LinearGenomeView |
| [](/docs/config/hictrack) | [](/docs/config/linearhicdisplay) | LinearGenomeView |
| [](/docs/config/ldtrack) | [](/docs/config/ldtrackdisplay) | LinearGenomeView |
| [](/docs/config/maftrack) | [](/docs/config/linearmafdisplay) | LinearGenomeView |
| [](/docs/config/multiquantitativetrack) | [](/docs/config/multilinearwiggledisplay) | LinearGenomeView |
| [](/docs/config/quantitativetrack) | [](/docs/config/linearwiggledisplay) | LinearGenomeView |
| [](/docs/config/referencesequencetrack) | [](/docs/config/lineargccontentdisplay) | LinearGenomeView |
|  | [](/docs/config/linearreferencesequencedisplay) | LinearGenomeView |
| [](/docs/config/syntenytrack) | [](/docs/config/dotplotdisplay) | DotplotView |
|  | [](/docs/config/lgvsyntenydisplay) | LinearGenomeView |
|  | [](/docs/config/linearsyntenydisplay) | LinearSyntenyView |
| [](/docs/config/varianttrack) | [](/docs/config/chordvariantdisplay) | CircularView |
|  | [](/docs/config/lddisplay) | LinearGenomeView |
|  | [](/docs/config/linearmultisamplevariantdisplay) | LinearGenomeView |
|  | [](/docs/config/linearmultisamplevariantmatrixdisplay) | LinearGenomeView |
|  | [](/docs/config/linearpairedarcdisplay) | LinearGenomeView |
|  | [](/docs/config/linearvariantdisplay) | LinearGenomeView |

<!-- DISPLAY_VIEW_TYPES END -->

Add a track type only when you need a new conceptual track category, a custom
config schema for that category, or behavior shared across multiple displays.
Register it with `pluginManager.addTrackType(...)`, reusing the base track
config schema.

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
itself. Its rendering backend is not a pluggable element: the display builds one
with `createRenderingBackend`, which walks the WebGPU → WebGL2 → Canvas2D
ladder, or with `createCanvas2DBackend` when it ships no shader path.

## Display foundations

LGV displays compose one **foundation mixin** on `BaseDisplay`, all sharing
`baseLinearDisplayConfigSchema`. The foundation answers how the display
_fetches_; how it _renders_ is a separate axis on top.

<!-- DISPLAY_FOUNDATIONS START -->

<!-- prettier-ignore -->
| Foundation | Brings | Used by |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | Per-region fetch + render: the fetch autoruns, `rpcProps()` refetch wiring, and byte gating. The common case. | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `LinearReferenceSequenceDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `GlobalDataDisplayMixin()` | One non-regional dataset with no per-region partitioning, plus the GPU render lifecycle. Installs no fetch autoruns; the display adds its own via `installGlobalFetchAutorun`. | `LinearHicDisplay`, `SharedLDModel` |
| `GlobalFetchMixin()` | The same single-global fetch foundation without the render lifecycle, so a non-GPU display that paints main-thread SVG does not drag it in. | `LinearArcDisplay`, `LinearPairedArcDisplay` |

<!-- DISPLAY_FOUNDATIONS END -->

Both walkthroughs use `MultiRegionDisplayMixin`, the common case. Compose one of
these rather than emitting SVG per feature. The
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#display-stacks)
goes further into why fetch and render are split.

## Cross-cutting mixins

Orthogonal to the foundation — compose any of them on top of whichever one you
picked. Each is one mixin with one overridable hook, and composing it **is** the
opt-in: a display that never overrides the hook gets the default and pays
nothing. Reach for one before writing the behavior yourself; each replaced
several hand-written copies that had already drifted, and **Composed by** is
read off the `types.compose(...)` calls, so it also answers "does anything else
already do this?"

<!-- CROSS_CUTTING_MIXINS START -->

<!-- prettier-ignore -->
| Mixin | The display supplies | Composed by |
| --- | --- | --- |
| `TrackHeightMixin()` | Internal vertical scroll. `scrollableHeight` (default `Infinity` = doesn't scroll). Brings the clamped `setScrollTop` and the autorun that re-clamps when content shrinks | `LinearAlignmentsDisplay`, `LinearArcDisplay`, `LinearCanvasBaseDisplay`, `LinearHicDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `LinearPairedArcDisplay`, `LinearReferenceSequenceDisplay`, `LinearScoreDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `SharedLDModel` |
| `LegendMixin()` | A legend the user can turn off. A promotable `showLegend` config slot, whose `promotedBase` sets whether this display type's legend is on by default. Brings the resolved `showLegend` getter, the `showLegendDisplayTypeDefault` pin `showLegendCheckboxItem` takes, and `setShowLegend` | `LinearAlignmentsDisplay`, `LinearHicDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `SharedLDModel` |
| `TreeSidebarMixin()` | Row set with a dendrogram sidebar. `sources` (the display rows, named), the three `treeSidebarConfigSchemaFields` slots, plus the `run` callback naming its own clustering RPC. Brings `layout` / `clusterTree` / `clusterProvenance` / `treeAreaWidth` / `subtreeFilter`, the `showTree` / `showBranchLength` / `showRowLabels` getters and setters over those slots, the `runClustering` / `clusterRegion` declarative launch pair `setupRunClusteringAutorun` consumes, the `root` and `willClearTree` getters, and the tree-hover and canvas-ref volatiles the shared sidebar draws through | `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `HeightModeMixin()` | Track-height strategy; the one row that must compose **after** `TrackHeightMixin()`, whose `height` and `resizeHeight` it overrides. `growTargetHeight` (default = the raw slot). Brings `heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive `height` override, `setHeightMode`, and the grow-aware `resizeHeight` | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay` |
| `ScoreScaleMixin()` | Score axis. Nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `*Bound` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume | `LinearAlignmentsDisplay`, `WiggleScoreConfigMixin` |
| `StaleViewportRescaleMixin()` | Stale-pixel rescaling for a display whose worker output is in fetch-time pixel space. Nothing — the display records `lastDrawnOffsetPx`/`lastDrawnBpPerPx` from its render callback. Brings the `renderTransform` that keeps stale pixels aligned during a pan-during-fetch and the `viewportFresh` half of `dataCurrent` | `LinearHicDisplay`, `SharedLDModel` |

<!-- CROSS_CUTTING_MIXINS END -->

Order matters in one place: `types.compose` gives a collision to the later
argument, so composing `HeightModeMixin()` before `TrackHeightMixin()` silently
leaves grow mode inert. The mixin reports that at attach rather than letting you
find it visually.

## Walkthroughs

Two end-to-end guides build the same display, differing only in the renderer.
Start with the first:

- [](/docs/developer_guides/plotting_features) - fetch in a worker, draw with
  Canvas2D. Right for gene-scale tracks, and no shaders involved.
- [](/docs/developer_guides/creating_gpu_display) - the same display with a
  `.slang` shader behind it, for roughly ≳100K features per frame.

Both are build-step plugins; [](/docs/developer_guides/simple_plugin) covers the
scaffold and build setup they assume.

For a worked in-tree display, read `plugins/wiggle/src/LinearWiggleDisplay` for
an overlay drawn over rendered content, or
`plugins/alignments/src/LinearAlignmentsDisplay` for many toggleable menu items
and a custom feature widget.

## See also

- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/svg_export)

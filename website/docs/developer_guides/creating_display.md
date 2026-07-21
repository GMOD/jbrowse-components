---
title: Custom track and display types
description:
  Define track types (high-level identity) and display types (how a track
  renders in a given view)
guide_category: Creating pluggable elements
---

A **track** owns the high-level identity (an ID, a name, a default set of
displays), while **display types** do the work of showing that track inside a
particular view, and **renderers** turn features into pixels.

```
Track  ─owns→  Display(s)  ─call→  Renderer
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

This factoring means: **if you're adding a new way to visualize data in an
existing view, you almost always want a display type, not a track type.** Add a
track type only when you need a new conceptual track category, a custom config
schema for that category, or behavior shared across multiple displays.

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
- Bundling a specific adapter + renderer pair so users get the right combination
  by default, instead of relying on the generic `FeatureTrack` /
  `LinearBasicDisplay`

The display owns view-specific state, menu items, and overlays; the
[renderer](/docs/developer_guides/renderer_architecture) it invokes does the
per-feature drawing. Which foundation mixin a display composes
(`MultiRegionDisplayMixin` for per-region data, `GlobalDataDisplayMixin` for a
single whole-view dataset like a heatmap) is spelled out in the
[architecture spec's display-stacks table](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#display-stacks).

## Pairing displays with tracks and views

A display registers itself as compatible with one view type. For example
`LinearVariantDisplay` is registered against `LinearGenomeView`, while
`ChordVariantDisplay` is registered against `CircularView`. Both belong to the
same `VariantTrack`.

## Walkthroughs

- [plugin templates](/docs/developer_guides/simple_plugin) - full scaffold and
  build setup
- [no-build plugin tutorial](/docs/developer_guides/no_build_plugin) - same idea
  without a bundler

In-tree references:

- `plugins/wiggle/src/LinearWiggleDisplay` - adds a Y-scale overlay on top of
  the rendered content
- `plugins/alignments/src/LinearAlignmentsDisplay` - rich display with many
  toggleable menu items and a custom feature widget
- `plugins/variants/src/LinearVariantDisplay` and
  `plugins/circular-view/src/ChordVariantDisplay` - two displays for one track
  type, in different view types

## See also

- [Renderer architecture](/docs/developer_guides/renderer_architecture)
- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
- [Data fetching pipeline](/docs/developer_guides/data_fetching)
- [Adding SVG export to a display](/docs/developer_guides/svg_export)
- [Pluggable elements](/docs/developer_guides/pluggable_elements)

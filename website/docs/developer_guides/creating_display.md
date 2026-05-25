---
id: creating_display
title: Creating custom display types
description: Control how a track renders in a given view type
guide_category: Creating pluggable elements
---

A display type tells JBrowse how to show a given track inside a particular view.
The same track can have several displays — one for each view it can appear in,
or several alternative renderings inside the same view. The display owns
view-specific state, menu items, and overlays; the
[renderer](/docs/developer_guides/creating_renderer) it invokes does the
per-feature drawing.

## When to add a custom display type

- Drawing chrome over the rendered content (e.g. the Y-scale axis in wiggle
  tracks, soft-clip indicators in alignments)
- Adding track-menu items that toggle display-only state (e.g. "Show soft
  clipping", "Color by methylation")
- Wiring a custom widget into feature clicks (e.g. `VariantFeatureWidget`)
- Bundling a specific adapter + renderer pair so users get the right combination
  by default, instead of relying on the generic `BasicTrack`

## Pairing displays with tracks and views

A display registers itself as compatible with one view type. For example
`LinearVariantDisplay` is registered against `LinearGenomeView`, while
`ChordVariantDisplay` is registered against `CircularView` — both belong to the
same `VariantTrack`. See
[creating custom track types](/docs/developer_guides/creating_track) for how
that split is intended to work.

## Walkthroughs

- [simple plugin tutorial](/docs/developer_guides/simple_plugin) - full scaffold
  including a display type
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

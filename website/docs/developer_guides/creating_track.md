---
title: Creating custom track types
description: Define new high-level track concepts backed by display types
guide_category: Creating pluggable elements
---

Tracks are deliberately thin. The track type owns the high-level identity (an
ID, a name, a default set of displays), while **display types** do the work of
showing the track inside a particular view, and **renderers** turn features into
pixels.

```
Track  ─owns→  Display(s)  ─call→  Renderer
```

For example:

- `AlignmentsTrack` owns `LinearAlignmentsDisplay`, which internally combines a
  pileup row and an SNP-coverage row — both ways of looking at BAM/CRAM data
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
the full set of slots.

For an end-to-end scaffold see the
[simple plugin tutorial](/docs/developer_guides/simple_plugin). Useful in-tree
references:

- `plugins/alignments/src/AlignmentsTrack` - multi-display track
- `plugins/variants/src/VariantTrack` - track shared across view types
- `plugins/hic/src/HicTrack` - track with a single dedicated display

## See also

- [Creating custom display types](/docs/developer_guides/creating_display)
- [Creating custom adapters](/docs/developer_guides/creating_adapter) — a track
  combines an adapter with its displays
- [Configuration schema](/docs/developer_guides/configuration_schema) — define a
  custom config schema for the track category

---
id: creating_track
title: Creating custom track types
---

Important note: track types are "high level concepts", and don't do a lot of
logic: instead "display" types register themselves to a track type, to display
data in a particular view. Then, the renderers are called by the display type on
e.g. a per-block basis

### Examples of track types

For examples of custom track types, refer to things like:

- `HicTrack` - uses the `LinearHicDisplay` which calls the HicRenderer to draw
  contact matrix
- `VariantTrack` uses the `ChordVariantDisplay` in the `CircularView` (to render
  VCF records as chords) and `LinearVariantDisplay` in the `LinearGenomeView`.
  `LinearVariantDisplay` is similar to a normal feature track but has a custom
  feature details widget via a "selectFeature" override.
- `SyntenyTrack` - synteny tracks can be displayed in multiple view types like
  DotplotView and LinearSyntenyView. It uses the `DotplotDisplay` or
  `LinearSyntenyDisplay` respectively to achieve this

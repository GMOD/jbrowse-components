---
name: circular-quantitative-ring
description: A wiggle drawn around the ring is the oldest unbuilt idea in the circular view, and the data half is already shipped — BigWigAdapter.getFeatureArraysMulti fetches every slice in one bbi pass at a zoom level chosen from bpPerPx. What is missing is a display, and the question that decides where it lives is which plugin owns QuantitativeTrack.
---

# A quantitative ring for the circular view

The circular view draws one thing: chords between two points. Every Circos
figure a reader arrives already able to read has rings outside the chords —
coverage, GC, copy number — and JBrowse has never drawn one. This has been
wanted for a long time and never worked on, so what follows is what is already
built, what is missing, and the one decision that has to come first.

## The data half is done

A ring needs one binned pass over every slice of the circle at a resolution
matched to the ring's pixel circumference. That is exactly what
`BigWigAdapter.getFeatureArraysMulti` already does, and its own comment names
whole-genome overviews as the case it was written for:

> one bbi pass over all regions, coalescing adjacent on-disk blocks across
> region boundaries (fewer range requests than N independent `getFeatureArrays`
> calls — the win for collapsed-intron and whole-genome overviews). All regions
> share one zoom level, selected from the view's `bpPerPx`, so a single
> `basesPerSpan` is correct.

The circular view supplies every input that call wants. `elidedRegions` is the
region list, `bpPerPx` picks the zoom level, and `staticSlices` already maps a
region onto its angular wedge — `Slice` carries `bpToRadians`, which is the
whole coordinate transform a ring needs. `radiusPx` sets the band. Nothing here
has to be invented, and none of it is linear-view machinery wearing a disguise.

`fetchRegionRaws.ts` is the existing caller shape: it feature-detects
`getFeatureArraysMulti` and falls back to per-region `getFeatureArrays`, so an
adapter without the fast path still works.

## What is missing

A display, and a polar draw function. Neither is small, but neither is
research:

- **The draw.** A wiggle in a wedge is `scores[i]` mapped to a radius between
  the band's inner and outer edge, at the angle `bpToRadians` gives its bin.
  `wiggle-core` already owns the score side of that — `getNiceDomain`,
  `getScale`, the autoscale, `ScoreScaleMixin` — and none of it knows about
  cartesian layout. What it does not own is a radial equivalent of the y-axis
  bar, and a ring's "y axis" is a set of concentric guide circles.
- **The fetch lifecycle.** A circular display does not compose either LGV fetch
  foundation; `ChordVariantDisplay` runs a bare autorun over
  `createStopTokenRotation` and a `ready` getter, which is the pattern
  `ARCHITECTURE.md` describes for the non-LGV views. A ring display copies that
  shape, not `GlobalFetchMixin`.
- **The SVG export gate.** `computeSvgReady` with `extraTerminal` for the
  no-displayed-regions case, the same way the chord display spells it.

Draw it on Canvas2D first and stop there. A ring is one pass over a few thousand
bins at whole-genome zoom, the circular view has no shader path at all today,
and `ARCHITECTURE.md`'s rule is that Canvas2D is the floor because SVG export
runs it — so the floor is also the whole job here.

## The decision that comes first: which plugin owns the track type

`ChordVariantDisplay` lives in `plugin-circular-view`, not in
`plugin-variants` — the view plugin owns its own displays and depends on the
plugin supplying the track type and adapters. Follow that precedent and a
`CircularQuantitativeDisplay` lives in `plugin-circular-view` too, which then
needs `QuantitativeTrack` and `BigWigAdapter`. Both are in `plugin-wiggle`,
alongside `LinearWiggleDisplay` and `MultiLinearWiggleDisplay` and their
shaders.

So the ring makes `plugin-circular-view` depend on the entire linear wiggle
stack to get a track type that is display-agnostic by construction —
`QuantitativeTrack` is `createBaseTrackModel` plus one `saveTrackFileFormatOptions`
view, and nothing in it is linear.

That is the same shape as the problem measured in the embedded circular product,
where `plugin-variants` is a dependency purely for `VariantTrack` and the VCF
adapters and drags `plugin-canvas`, `plugin-linear-genome-view` and
`tree-sidebar` in behind it. One split answers both: a plugin owning the track
type and the adapters, with the linear displays layered on top, the way
`wiggle-core` and `sv-core` already separate domain code from the plugin that
registers it. Doing the ring without that split welds the two together in a
second place and makes the split harder.

**`plugin-wiggle` was dropped from the embedded circular product's
`corePlugins`** on the grounds that both of its displays are
`viewType: 'LinearGenomeView'` and nothing in a circular-only product could
reach them. That stays true until this lands, and it is not a vote against the
ring — if the ring ships, what comes back is the split, not the whole plugin.

## Two more things to settle before the code

- **Where the band goes.** The chords own the interior and taking a band out of
  it makes them worse. This is the same radius budget
  [sv-size-ring](sv-size-ring.md) is spending, and that doc is the one to read
  first: it wants an inner ring for local SV events, this wants an outer one for
  a quantitative track, and if both happen the circle needs a band allocator
  rather than two displays each picking a radius.
- **How many rings.** One display per track puts N rings on one circle with
  nothing arbitrating their order or thickness, which is the point at which the
  view needs a concept it does not have. Shipping exactly one ring first is a
  real answer, not a placeholder.

## Why it is not in TODO.md

Nobody has committed to it, and the ordering above says the plugin split is the
honest first commit rather than the display. It is also a visual design — how a
ring shares a circle with chords — and those have gone badly here when started
from the code end.

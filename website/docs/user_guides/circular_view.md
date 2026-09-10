---
title: Circular genome view
description:
  Whole-genome rings of quantitative tracks, with structural variants and
  synteny drawn as chords and ribbons across the interior
guide_category: Views
---

**TL;DR:** The circular genome view lays out an entire assembly as a ring and
draws long-range structural variants as chords across the interior, one arc per
event connecting its two breakpoints. An arc with its two ends in different
chromosome segments is an inter-chromosomal event, which no single linear window
can hold. Any track that draws in the linear genome view — a bigWig, a feature
density, an alignment coverage — draws on the circle as a ring inside the
ideogram, so a Circos-style figure is the same tracks opened on this view.

<Figure caption="A circular genome view of a structural-variant VCF. Each chord connects the two breakpoints of one variant; arcs spanning between different chromosomes are inter-chromosomal events (translocations/breakends)." src="/img/jbrowse-img/circular_chords.png" />

## Opening a circular genome view

- Launch **Circular view** from the **Add** menu in the main menu bar
- Select an assembly in the import form and click **Open**. The ring appears
  with one segment per chromosome
- Add a variant track from the view's track selector; SV chords render
  automatically as a **Chord variant display**

The view reads standard VCF/VCF.gz variant tracks. Chords are drawn from
long-range records (`SVTYPE=BND` breakends and translocations). Single-locus
deletions and duplications load but don't produce an informative chord.

## Rings

A track whose display draws in the linear genome view draws on the circle as a
ring: open it from the view's track selector, or name it in the view's `tracks`.
Rings stack inward from the ideogram in the order the tracks were opened, each
as tall as the display's height, and the chords and ribbons draw inside the
innermost ring. Every setting the display has on a linear view — a wiggle's plot
type and colour, a mark display's `marks` — applies on the ring, and hovering or
clicking a ring is the same hover and click as on the linear track: the tooltip
and the feature details are the display's own.

A ring is the display's linear rendering wrapped around the circle: the display
draws a strip as long as the circumference, and the view resamples it so each
base sits at its arc. Inner rings are drawn from the same strip and so resolve a
little coarser than the outer ones.

<!-- include: products/jbrowse-web/src/tests/CircularViewRing.test.tsx#ringView -->

```ts
const ringView = {
  type: 'CircularView',
  assembly: 'volvox',
  tracks: ['volvox_microarray'],
}
```

<Figure src="/img/circular_view/coverage_ring_chords.png" caption="A cancer cell line's long-read coverage as a ring, on a log scale, with its translocations as chords: the copy-number steps sit where the chords land."/>

A variant or synteny track keeps its chords and ribbons; a track that has both a
linear and a circular display takes the circular one unless the entry names the
other, as `{ trackId, displaySnapshot: { type: 'LinearMarkDisplay' } }` does for
a density ring over a variant track. An alignments track draws its coverage and
pileup as a ring; for a coverage ring alone, open the track as a
[mark display](/docs/config/linearmarkdisplay) with a `coverage` transform.

<Figure src="/img/circular_synteny/rings.png" caption="Two assemblies on one circle, human chromosomes clockwise from the top and mouse after them, with a gene density ring inside the ideogram and the liftOver blocks between the genomes as ribbons, red forward and blue reverse." />

## Interacting with chords

- **Hover** a chord to highlight it and see the variant it represents
- **Click** a chord to open that variant's feature details
- From the feature-detail panel's **Breakends** section, use **Open in
  breakpoint split view** to open a
  [breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view)
  centered on the event's two breakpoints

To triage many variants at once, use the
[SV inspector](/docs/user_guides/sv_inspector_view), which pairs this same
circular overview with a filterable variant table and cross-filters the two
together.

## See also

- [](/docs/user_guides/sv_inspector_view)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [Cancer SVs (C-GIAB) tutorial](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/circular_synteny)
- [ChordVariantDisplay config schema](/docs/config/chordvariantdisplay)
- [LinearMarkDisplay config schema](/docs/config/linearmarkdisplay), for a
  density or coverage ring

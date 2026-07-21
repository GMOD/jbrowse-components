---
title: Circular genome view
description: Whole-genome chord plot of structural variants
guide_category: Views
---

The circular genome view lays out an entire assembly as a ring and draws
long-range structural variants as chords across the interior. It is the best way
to see translocations, inter-chromosomal breakends, and other whole-genome
rearrangements at a glance. Each arc connects the two breakpoints of one event.

<Figure caption="A circular genome view of a structural-variant VCF. Each chord connects the two breakpoints of one variant; arcs spanning between different chromosomes are inter-chromosomal events (translocations/breakends)." src="/img/jbrowse-img/circular_chords.png" />

## Opening a circular genome view

- Launch **Circular view** from the **Add** menu in the main menu bar
- Select an assembly in the import form and click **Open**. The ring appears
  with one segment per chromosome
- Add a variant track from the view's track selector; SV chords render
  automatically as a **Chord variant display**

The view reads standard VCF/VCF.gz variant tracks. It is aimed at the same
long-range records as the [SV inspector](/docs/user_guides/sv_inspector_view):
`SVTYPE=BND` breakends and translocations. Single-locus deletions and
duplications load but don't produce an informative chord.

## Interacting with chords

- **Hover** a chord to highlight it and see the variant it represents
- **Click** a chord to open that variant's feature details
- From the feature-detail panel's **Breakends** section, use **Open in
  breakpoint split view** to open a
  [breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view)
  centered on the event's two breakpoints

The [SV inspector](/docs/user_guides/sv_inspector_view) pairs this same circular
overview with a filterable variant table and wires a single chord click straight
to the breakpoint split view. Reach for it when you want to triage many variants
at once rather than plot a single track.

## See also

- [SV inspector view](/docs/user_guides/sv_inspector_view)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [Cancer SVs (C-GIAB) tutorial](/docs/tutorials/sv_visualization_cgiab)
- [ChordVariantDisplay config schema](/docs/config/chordvariantdisplay)
- [Gallery: structural variant examples](/gallery/#sv)

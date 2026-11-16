---
title: Circular genome view
description:
  Whole-genome rings of quantitative tracks, with structural variants and
  synteny drawn as chords and ribbons across the interior
guide_category: Views
---

The circular genome view lays out an entire assembly as a ring and draws
long-range structural variants as chords across the interior, one arc per event
connecting its two breakpoints. An arc with its two ends in different chromosome
segments is an inter-chromosomal event, which a linear view shows only as two
separate regions. Any track that draws in the linear genome view — a bigWig, a
feature density, an alignment coverage — draws on the circle as a ring inside
the ideogram, so a Circos-style figure is the same tracks opened on this view.

<Figure caption="A circular view of a structural-variant VCF, each chord joining the two breakpoints of one variant." src="/img/jbrowse-img/circular_chords.png" />

## Opening a circular genome view

- Launch **Circular view** from the **Add** menu in the main menu bar
- In the import form's **Manual** mode, select an assembly and click **Launch**.
  The ring appears with one segment per chromosome
- Add a variant track from the view's track selector; SV chords render
  automatically as a **Chord variant display**

The view reads standard VCF/VCF.gz variant tracks. Chords are drawn from
long-range records (`SVTYPE=BND` breakends and translocations). Single-locus
deletions and duplications load but don't produce an informative chord.

## Rings

A track whose display draws in the linear genome view draws on the circle as a
ring: open it from the view's track selector, or name it in the view's `tracks`.

- **Track menus:** each track's menu is under **Tracks** in the view menu
- **Legend:** **Show legend** in the same menu names each ring, chord and ribbon
  track beside the color or density ramp it draws in (a view's
  `legend: { show: true }` opens with it)
- **Stacking:** rings stack inward from the ideogram in the order the tracks
  were opened, each as tall as the display's height, and the chords and ribbons
  draw inside the innermost ring. Inner rings resolve a little coarser than
  outer ones
- **Axis:** a quantitative ring draws its score axis radially in the gap before
  the first chromosome
- **Settings and hover:** every setting the display has on a linear view (a
  wiggle's plot type and color, a mark display's `marks`) applies on the ring,
  and the tooltip and feature details are the display's own

<!-- include: products/jbrowse-web/src/tests/CircularViewRing.test.tsx#ringView -->

```ts
const ringView = {
  type: 'CircularView',
  assembly: 'volvox',
  tracks: ['volvox_microarray'],
}
```

<Figure src="/img/circular_view/coverage_ring_chords.png" caption="A cancer cell line's coverage as a ring on a log scale, its translocations as chords."/>

A multi-source quantitative track with its sources on rows gives each source a
band inside one ring. The bands share the display's score domain and draw no
axis or row labels, so name that domain where the bands are read against each
other, and give each subtrack a `color` in the adapter to tell them apart.

<Figure src="/img/circular_view/tumor_normal_rings.png" caption="A tumour and its matched normal as two bands of one multi-source quantitative track, with the SV truth set as chords." />

- **Variant and synteny tracks** keep their chords and ribbons. A track with
  both a linear and a circular display takes the circular one unless the entry
  names the other, as
  `{ trackId, displaySnapshot: { type: 'LinearMarkDisplay' } }` does for a
  density ring over a variant track
- **Alignments tracks** draw coverage and pileup as a ring; for a coverage ring
  alone, open the track as a [mark display](/docs/config/linearmarkdisplay) with
  a `coverage` transform
- **Mirrored arcs** mirror their rings too, so a ring bin stays under its
  stretch of ideogram

<Figure src="/img/circular_synteny/rings.png" caption="Human and mouse on one circle with a gene density ring inside the ideogram and liftOver blocks as ribbons." />

## Synteny ribbons

A `SyntenyTrack` draws each alignment as a ribbon between the span it covers on
one side and the span its mate covers on the other, so an inversion reads as a
twist. Worked through in [](/docs/tutorials/circular_synteny).

- **Two genomes:** a track aligning two genomes needs both on the circle, set
  with `assembly: ['hg38', 'mm39']`; each lays its chromosomes out in turn
- **Import form:** as in the dotplot, **Quick start** picks a synteny track and
  opens its two genomes, and **Manual** takes **Add a second assembly** and a
  track for the pair, with a chromosome box per genome
- **Chromosome order:** a two-genome circle opens reordered, the second genome's
  chromosomes in the order of the first's by shared aligned bases and laid out
  mirrored, so the ribbons form a band of parallel arcs. **Re-order
  chromosomes** in the view's menu, offered only on such a circle, reorders on
  demand, and `autoDiagonalize: false` on the view keeps each genome in its
  contig order
- **Color:** ribbons open in the ideogram color of the first genome's chromosome
  they leave. **Color by** in the view's menu offers what the linear synteny
  view's palette offers: either genome's chromosome, strand, identity or another
  measurement, a column the track declares, or one color per track when several
  overlay
- **Opacity**, **Identity fade**, **Min length** and **Min identity** sit beside
  it. In a session they are `encoding.color`, `encoding.opacity` and `filter`;
  the identity fade is `encoding: { opacity: { field: 'identity' } }`
- **Sub-pixel alignments** draw at the share of the pixel they cover, so a dense
  circle shows where short alignments pile up; `render: { antialias: false }` on
  the view draws every ribbon at full opacity
- **Hover** a ribbon or chord to highlight and name it; **click** to open its
  details

<Figure src="/img/circular_synteny/color_by_strand.png" caption="Color by → Strand on the human and mouse circle." />

### Karyotype changes on other pairs

Each circle below opens from a separate demo config. The human and chimpanzee
one reads the hosted UCSC liftOver chain, built by
`scripts/build_circular_synteny.sh` with `QUERY=panTro6`. The other two start
from nothing but two FASTA files: `scripts/build_circular_synteny_fasta.sh`
aligns them with minimap2 and indexes the result with `jbrowse make-pif`. The
circles show the human chr2 fusion and the chimp pericentric inversions (Yunis
and Prakash 1982), the rearrangements between two Yersinia pestis strains (Deng
et al. 2002) and the Brassica rapa triplication (Wang et al. 2011).

<Figure src="/img/circular_synteny/chimp_strand.png" caption="Human and chimpanzee colored by strand." />

<Figure src="/img/circular_synteny/yersinia.png" caption="Two Yersinia pestis strains, one chromosome each, colored by strand." />

<Figure src="/img/circular_synteny/brassica_triplication.png" caption="Arabidopsis chromosome 4 against the whole Brassica rapa genome. The B. rapa ideogram is painted only where blocks land." />

<Figure src="/img/circular_synteny/brassica_mosaic.png" caption="Both whole genomes, the B. rapa ideogram painted in the five Arabidopsis chromosomes' colors." />

Citations:

- Yunis and Prakash (1982).
  [The origin of man: a chromosomal pictorial legacy](https://doi.org/10.1126/science.7063861)
- Deng et al. (2002).
  [Genome sequence of _Yersinia pestis_ KIM](https://doi.org/10.1128/JB.184.16.4601-4611.2002)
- Wang et al. (2011).
  [The genome of the mesopolyploid crop species _Brassica rapa_](https://doi.org/10.1038/ng.919)

## Interacting with chords

- **Hover** a chord to highlight it and see the variant it represents
- **Click** a chord to open that variant's feature details
- From the feature-detail panel's **Breakends** section, use **Open in
  breakpoint split view** to open a
  [breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view)
  centered on the event's two breakpoints

The circle fetches every chromosome it shows at once, so a VCF whose index puts
that fetch over the track's
[`fetchSizeLimit`](/docs/config/chordvariantdisplay/#slot-fetchsizelimit) shows
a banner instead of chords. Show fewer chromosomes, draw the track as a ring
from **Display types**, or press **Force load**; `forceLoad: true` in the
display's config, or `force:true` on a `jb2export circular` track, does the same
without the button.

To triage many variants at once, use the
[SV inspector](/docs/user_guides/sv_inspector_view), which pairs this same
circular overview with a filterable variant table and cross-filters the two
together.

## See also

- [](/docs/user_guides/sv_inspector_view)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [Cancer SVs (C-GIAB) tutorial](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/circular_synteny)
- [](/docs/tutorials/organelle_map)
- [ChordVariantDisplay config schema](/docs/config/chordvariantdisplay)
- [ChordSyntenyDisplay config schema](/docs/config/chordsyntenydisplay)
- [LinearMarkDisplay config schema](/docs/config/linearmarkdisplay), for a
  density or coverage ring

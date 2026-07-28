---
title: Linear synteny view
description: Side-by-side alignment of two genomes
guide_category: Views
---

**TL;DR:** The linear synteny view stacks two genomes, one above the other, and
draws their alignments as ribbons connecting matching regions. Each panel
behaves like a linear genome view, so you can scroll, zoom, and add tracks to
either side independently while the ribbons follow.

Forward-strand alignments are drawn in one color and inverted alignments in
another, so a ribbon that twists or crosses marks an inversion or rearrangement.

## Opening a linear synteny view

Launch a new Linear synteny view. If your config already has a synteny track,
the form opens in **Quick start**: pick the track, click **Launch**, and it
fills in a row per assembly the track names. **Swap** reverses that row order,
since a synteny track is queryable in either direction and its listed order does
not claim which genome belongs on top. Switch to **Manual** to select the two
assemblies yourself and optionally add a .paf, .out (MashMap), .delta (MUMmer),
.chain, .anchors, or .anchors.simple (MCScan) file. Manual also stacks more than
two genomes, from an [all-vs-all PAF](/docs/tutorials/allvsall_synteny), an
[MCScan ortholog table](/docs/tutorials/multiway_synteny), or a
[pangenome graph's linear projections](/docs/tutorials/pangenome_ecoli).

<Figure caption="Synteny and dotplot views share an import form, reached from the Add menu (shown here via Dotplot view; Linear synteny view opens the same form). Its Manual mode, shown here, is where you select two different assemblies and can supply an additional file." src="/img/dotplot_add.png" />

<Figure caption="Screenshot showing the linear synteny view for the grape vs peach genome." src="/img/linear_synteny.png" />

### From a locus you are already looking at

The import form starts from two assemblies. The other way round is to start from
a locus in a linear genome view that has a synteny dataset covering its
assembly, and let JBrowse frame the panels for you. The dataset does not have to
be an open track:

- **Drag-select a region** on the scale bar and pick **Linear synteny view of
  selection**. JBrowse reads that region back out of the alignment, finds every
  assembly aligning to it, and opens a panel for each. The dialog lists them top
  to bottom with up/down arrows, the assembly you selected in among them:
  ribbons are drawn between neighbouring panels only, so that order decides
  which comparisons the view can show. This is the form to use for an
  [all-vs-all](/docs/tutorials/allvsall_synteny) dataset, where a locus reaches
  several assemblies at once.
- **Right-click a single alignment** in a synteny track drawn in a linear genome
  view and pick **Launch synteny view for this position**, which opens the one
  pair that alignment describes. Its **Use CIGAR to map the current visible
  region to the target** option walks the alignment to find the interval that
  actually matches what you are looking at, rather than framing on the whole
  block's endpoints. Worked through in [](/docs/tutorials/genomes_synteny).
- The same **Linear synteny view (visible region)** entry sits in the view's
  hamburger menu under **Launch view**, for when the region you want is the
  whole view and there is nothing to select.

Both dialogs offer a **window size** (padding added to every panel) and a
**horizontally flip inverted targets** checkbox. Without flipping, an inverted
panel's coordinates run right to left.

## Navigating each panel

Each genome panel is a full linear genome view and is controlled independently:

- scroll, zoom, and pan either panel on its own; ribbons redraw to follow
- type a region or gene name into a panel's search box to jump it there
- add tracks (genes, alignments, coverage) to either side from its track
  selector, useful for reading what a syntenic block actually contains

## Interacting with the ribbons

- Hover a ribbon to see a tooltip with the alignment's coordinates on both
  genomes and, when zoomed in, the CIGAR operation under the cursor
- Click a ribbon to highlight it across both panels
- Right-click a ribbon for a context menu with **Center on feature**, which
  recenters both panels on that alignment

## View options

The view's hamburger menu controls how the ribbons are drawn:

- Show curved lines - draw ribbons as bezier curves instead of straight
  connectors
- CIGAR display mode - how per-base insertions and deletions inside each
  alignment are shown: **Colored indels** paints them, **Transparent indels**
  leaves them as see-through gaps in the ribbon, and **None** draws blocks only
- Show location markers - vertical guides marking each alignment's endpoints
- Show all regions - fit both whole assemblies into view
- Square view - equalize the horizontal scale of the two panels
- Add assembly row - compare three or more assemblies stacked vertically

<Figure caption="Human (hg38) vs chimp (panTro6) across an RB1 intron, from a UCSC liftOver chain with RepeatMasker on both genomes. A full-length ~6 kb L1HS present in human is absent at the orthologous chimp intron. The 'Colored indels' CIGAR display mode paints the insertion as a wedge in the ribbon, with RepeatMasker naming the element at the indel." src="/img/synteny_human_chimp_cigar_modes.png" />

### More lineage-specific insertions

The same human/chimp synteny plus RepeatMasker resolves other lineage-specific
transposon insertions. Each is a gap in the alignment with the element named at
the indel:

<Figure caption="A human-specific SVA_F (~2 kb) in an intron of VAPB, present in human and absent at the orthologous chimp intron." src="/img/synteny_te_vapb_sva.png" />

<Figure caption="A human-specific AluYb8 (~0.3 kb) in PICALM, inserted downstream of a conserved AluY present in both species. A small insertion still reads clearly as an indel." src="/img/synteny_te_picalm_alu.png" />

## See also

- [](/docs/user_guides/dotplot_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny) - hosted liftOver chains, nothing to set
  up
- [Synteny/dotplot configuration](/docs/config_guides/synteny_track)
- [](/docs/user_guides/maf_track)
- [Gallery: synteny examples](/gallery/#synteny)

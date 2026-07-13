---
title: MAF track
description: Viewing multiple alignment format (MAF) data
guide_category: Track types
---

A MAF track shows a multiple sequence alignment of several species (or samples)
against a reference genome: one row per aligned species, drawn at their true
genomic positions on the reference, with a coverage summary on top. It is the
view for "how does this region compare across many genomes at once", the kind of
multiz alignment UCSC publishes (e.g. the human 470-way or the _C. elegans_
26-way).

JBrowse reads three file formats, MAF (tabix-indexed BED), BigMaf, and bgzipped
TAF (taffy), all opened as a single track. To add one, use **File → Open track**
and point it at the data, or load a track an administrator has already
configured. The data-format and configuration details (adapters, supplying the
species list or a Newick guide tree) live in the
[MAF track configuration guide](/docs/config_guides/maf_track); this page covers
what you can do once the track is on screen.

<Figure src="/img/maf_track.png" caption="The UCSC ce11 26-way multiz alignment (C. elegans and related nematodes), with the ce11 NCBI RefSeq gene lane on top for context: the coverage band, then one row per species ordered by the guide tree in the left sidebar, with positions where a species differs from the reference drawn as colored marks. The conserved alignment blocks line up with the coding exons above."/>

Zoomed out, each pixel summarizes the alignment beneath it; zoom in and the
per-species rows resolve into individual bases, with positions where a species
differs from the reference drawn as colored marks. Most of the features below
are toggled from the track menu's **Show...** submenu.

## Conservation and per-row identity

The **Show conservation (% identity)** band plots, at each reference base, the
fraction of aligned species whose base matches the reference, a quick read of
which regions are conserved versus divergent. It is computed from the alignment
itself, so no extra files are needed.

Where conservation collapses every species into one profile, **Per-row
identity** breaks the same signal out per species so you can see _which_ genomes
diverge in a region. It offers two styles, **Heatmap** (each row shaded on a
red→grey→blue ramp, red divergent, blue conserved) and **X-Y plot** (a
per-species identity wiggle), plus **Off**. By default it swaps in only when you
zoom out past base level, where individual bases are no longer legible; uncheck
**Auto-switch by zoom** to pin it on at every zoom level.

This works on large alignments: with all ~470 species of the UCSC hg38 470-way
shown at once, the heatmap gives a per-base conservation view across the full
set of species.

<Figure src="/img/maf_470way.png" caption="The UCSC hg38 470-way multiz over the GAPDH locus. Fit-to-display-height mode squeezes all ~470 species into a 600px-tall display, so every row goes near-1px and the whole alignment reads as a texture with the guide tree (dendrogram) down the left. The per-row identity heatmap colors each base by whether it matches the reference row: blue where conserved, red where divergent (see the top-right legend). Conserved coding columns run blue top-to-bottom across the entire phylogeny, while gaps and less-conserved regions break up as red/white streaks."/>

## Color by source chromosome

**Color by source chromosome** replaces the per-base coloring with a structural
view. Within each species row, the source chromosomes its blocks come from (in
that species' own genome) are ranked by coverage: the row's main chromosome gets
the primary color, and blocks from a different source chromosome take a
contrasting accent. A row that stays one color is collinear; a row that _changes
color along its length_ is drawing blocks from more than one source chromosome,
an immediate flag for a translocation or rearrangement. Ranking per row keeps
this readable, with no per-scaffold rainbow, and a compact legend in the
top-right names the scheme (main / 2nd / 3rd source). Like conservation, it is
derived from the alignment with no extra data to fetch.

<Figure src="/img/maf_color_by_chromosome.png" caption="Color-by-source-chromosome mode on the ce11 26-way alignment: each species row is colored by its per-row source-chromosome rank, so a row stays one color when collinear and switches color (2nd/3rd source) where blocks come from a different source chromosome, marking rearrangements."/>

## Inversions (strand flips)

**Show inversions (strand flips)** overlays a diagonal hatch on any block that
aligns inverted relative to its own source chromosome's consensus orientation.
Comparing each block to its scaffold's consensus (rather than flagging every
`−`-strand block) means an arbitrarily-oriented scaffold is not mistaken for an
inversion, and only a genuine intra-scaffold strand flip is marked. It is an
overlay, so it composes on top of the base, codon, or per-row identity rendering
without replacing them.

## Codon (amino-acid) view

When the track has a CDS-frames file configured (a UCSC `mafFrames` annotation
on the display), the menu gains two coding-aware options. **Show CDS frames**
(off by default) draws a thin reading-frame-colored strip on each species' row,
marking the coding exons projected onto that species so the gene structure reads
vertically across the whole alignment.

**Codon view (amino-acid changes)** switches the per-sample rows from per-base
SNP coloring to a per-codon view: every species is translated in the reference
reading frame, and each codon cell is colored by how its amino acid compares to
the reference: nonsynonymous changes stand out, synonymous (silent) changes get
a faint tint, stop codons are flagged, and conserved codons stay clean. The
residue is drawn on each codon once you zoom in far enough to read it.

On a large alignment, narrowing to a focused set of species first (see
[Selecting a subtree](#selecting-a-subtree)) keeps the per-codon columns
legible.

<Figure src="/img/maf_470way_codon.png" caption="The hg38 470-way narrowed to ~30 representative mammals (one per major clade, plus opossum and platypus outgroups) in codon view at a conserved GAPDH exon: each species' coding sequence is translated in the human reading frame, so the conserved residues line up and the few amino-acid changes in the more distant lineages stand out. The left sidebar is the pruned ~30-leaf guide tree, not the full 470-species tree."/>

## Tooltips

Hovering any cell reads out the alignment at that position: the species, its
base, and the location in that species' own genome, plus the alignment status of
the neighboring blocks (e.g. a bridged gap and its size). Insertions, deletions,
and bridged e-line gaps each get their own tooltip. When the CDS-frames file is
loaded (in codon view, or with the strip on), the hover also shows the gene
name; in codon view it shows the species' codon and amino acid next to the
reference's and labels the change synonymous or nonsynonymous.

<Figure src="/img/maf_codon_tooltip.png" caption="The codon-view hover tooltip on the ce11 26-way alignment: over a codon cell it shows the species' codon and amino acid next to the reference's (here GAA → GCC, E → A) and labels the change nonsynonymous, alongside the alignment location and the CDS frame/gene the reading frame came from."/>

## Row layout and the species tree

The sidebar at the left shows the species labels, drawn as a dendrogram when the
track is configured with a Newick guide tree. **Show sidebar with tree and
labels** toggles it, and you can show branch lengths from the track menu.
**Edit row arrangement...** lets you reorder or hand-pick rows, and the **Row
height** submenu offers squeeze-to-fit, normal, compact, and custom row heights.

### Selecting a subtree

Click an internal node of the guide tree to filter the track to that clade, or
pick a set of species from **Edit row arrangement...**. The guide tree then
redraws as the pruned dendrogram of the kept species, so it matches the visible
rows rather than the full species tree, including for a selection that is not a
single clade. **Clear subtree filter** restores all species.

## See also

- [MAF track configuration](/docs/config_guides/maf_track) - adapters, supplying
  the species list or Newick tree, and the CDS-frames overlay setup
- [Linear synteny view](/docs/user_guides/linear_synteny_view) - pairwise
  alignment of two genomes, complementary to MAF's multiple alignment against
  one reference
- [Gene track](/docs/user_guides/gene_track) - the same reading-frame coloring
  and peptide lettering, applied to a single genome's CDS

---
title: MAF track
description: Viewing multiple alignment format (MAF) data
guide_category: Track types
---

**TL;DR:** A MAF track shows a multiple sequence alignment of several species
(or samples) against a reference genome: one row per aligned species at its true
genomic position, with a coverage summary on top. It answers "how does this
region compare across many genomes at once", the kind of multiz alignment UCSC
publishes (e.g. the human 470-way or the _C. elegans_ 26-way).

JBrowse reads three formats, MAF (tabix-indexed BED), BigMaf, and bgzipped TAF
(taffy), all opened as a single track. Add one with **File → Open track**, or
load a track an administrator has configured. Data-format and configuration
details (adapters, the species list or Newick guide tree) live in the
[MAF track configuration guide](/docs/config_guides/maf_track). This page covers
what you can do once the track is on screen.

<Figure src="/img/maf_track.png" caption="The UCSC ce11 26-way multiz alignment, with the ce11 NCBI RefSeq gene lane on top: the coverage band, then one row per species ordered by the guide tree, each species' differences from the reference drawn as colored marks. The conserved blocks line up with the coding exons above."/>

Zoomed out, each pixel summarizes the alignment beneath it. Zoom in and the
per-species rows resolve into individual bases, with positions where a species
differs from the reference drawn as colored marks. The features below come from
two track-menu submenus: **Row coloring** picks the one way the rows are
colored, and **Show...** holds the bands and overlays that layer on top of it.

## Zooming out past the alignment

Every MAF format packs each block's species sequences together, so a zoomed-out
query would download all of them — tens of megabytes for a single screen of a
deep alignment. JBrowse blocks that with a "requested too much data" prompt.

A track configured with a summary file shows presence bars there instead: one
bar per species per aligned region, shaded by the summary's score, with no
sequence read. Hover one to name the species, the aligned block and its score,
which on a deep alignment is how to tell one row from another once the labels
shrink away. Zooming back in swaps the bars for the alignment itself. Neither
the coverage band nor the conservation band is drawn on the summary tier, since
both are computed from the per-base alignment the tier exists to avoid reading.
Pointing a track at a summary file is covered in the
[MAF track configuration guide](/docs/config_guides/maf_track#the-zoom-out-tier).

<Figure src="/img/maf_summary_tier.png" caption="The UCSC hg38 470-way narrowed to ~30 representative mammals, over GAPDH at two zooms. At 180 kb (top) the track reads its summary file, one grey bar per species per aligned region. At 200 bp (bottom) it draws the alignment itself, one colored cell per base, with the coverage band above."/>

## Conservation and per-row identity

The **Show conservation (% identity)** band plots, at each reference base, the
fraction of aligned species whose base matches the reference, a quick read of
which regions are conserved versus divergent. It is computed from the alignment
itself, so no extra files are needed.

The **Row coloring** menu breaks the same signal out per species, so you can see
_which_ genomes diverge in a region. The rows are colored one way at a time:

- **Bases (SNPs vs reference)**, the default, is the per-base coloring described
  above.
- **Identity heatmap** shades each row on a red→grey→blue ramp (red divergent,
  blue conserved).
- **Identity X-Y plot** draws the same signal as a per-species wiggle.

The heatmap and the X-Y plot draw only while you are zoomed out past base level,
where individual bases are no longer legible, and zooming in swaps them back for
the ordinary base coloring; uncheck **Show bases when zoomed in** to keep the
plot on at every zoom level.

This works on large alignments: with all ~470 species of the UCSC hg38 470-way
shown at once, the heatmap gives a per-base conservation view across the full
set of species. Fit-to-display-height mode takes every species into one display,
so each row goes near-1px and the alignment reads as a texture, with the guide
tree (dendrogram) down the left.

<Figure src="/img/maf_470way.png" caption="The UCSC hg38 470-way multiz over the GAPDH locus, every species at once. Conserved coding columns run blue top-to-bottom across the whole phylogeny; gaps and less-conserved regions break up as red and white streaks."/>

## Color by source chromosome

**Source chromosome**, in the same **Row coloring** menu, replaces the per-base
coloring with a structural view. Within each species row, the source chromosomes
its blocks come from (in that species' own genome) are ranked by coverage: the
row's main chromosome gets the primary color, and blocks from a different source
chromosome take a contrasting accent. A row that stays one color is collinear; a
row that _changes color along its length_ is drawing blocks from more than one
source chromosome, an immediate flag for a translocation or rearrangement.
Ranking per row keeps this readable, and a compact legend in the top-right names
the scheme (main / 2nd / 3rd source). Like conservation, it is derived from the
alignment with no extra data to fetch.

<Figure src="/img/maf_color_by_chromosome.png" caption="Color-by-source-chromosome mode on the ce11 26-way alignment: each species row is colored by its source-chromosome rank, so a row stays one color when collinear and switches where blocks come from a different source chromosome."/>

## Inversions (strand flips)

**Show inversions (strand flips)** overlays a diagonal hatch on any block that
aligns inverted relative to its own source chromosome's consensus orientation.
Each block is compared to its scaffold's consensus, so an arbitrarily-oriented
scaffold reads as collinear and only a genuine intra-scaffold strand flip is
marked. It is an overlay, so it composes on top of the base, codon, or per-row
identity rendering.

## Codon (amino-acid) view

When the track has a CDS-frames file configured (a UCSC `mafFrames` annotation
on the display), two coding-aware options appear. **Show CDS frames** (off by
default, under **Show...**) draws a thin reading-frame-colored strip on each
species' row, marking the coding exons projected onto that species so the gene
structure reads vertically across the whole alignment. It is a strip drawn over
whatever the rows are colored by, so it composes with any **Row coloring**.

**Codon changes (amino acids)**, a **Row coloring** option, switches the
per-sample rows from per-base SNP coloring to a per-codon view: every species is
translated in the reference reading frame, and each codon cell is colored by how
its amino acid compares to the reference: nonsynonymous changes stand out,
synonymous (silent) changes get a faint tint, stop codons are flagged, and
conserved codons stay clean. The residue is drawn on each codon once you zoom in
far enough to read it.

<!-- COLOR_TABLE maf START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#e8930c;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#e8930c"></span> | Nonsynonymous codon | `#e8930c` | MAF codon view: the species' amino acid differs from the reference (nonsynonymous) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#3a7bd5;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#3a7bd5"></span> | Synonymous codon | `#3a7bd5` | MAF codon view: the codon differs from the reference but the amino acid is unchanged (silent) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#cc2222;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#cc2222"></span> | Codon stop | `#cc2222` | MAF codon view: a stop codon |

<!-- COLOR_TABLE maf END -->

On a large alignment, narrowing to a focused set of species first (see
[Selecting a subtree](#selecting-a-subtree)) keeps the per-codon columns
legible, and the left sidebar redraws as the pruned guide tree.

<Figure src="/img/maf_470way_codon.png" caption="The hg38 470-way narrowed to representative mammals, one per major clade plus opossum and platypus outgroups, in codon view at a conserved GAPDH exon."/>

## Tooltips

Hovering any cell reads out the alignment at that position: the species, its
base, and the location in that species' own genome, plus the alignment status of
the neighboring blocks (e.g. a bridged gap and its size). Insertions, deletions,
and bridged e-line gaps each get their own tooltip. When the CDS-frames file is
loaded (in codon view, or with the strip on), the hover also shows the gene
name; in codon view it shows the species' codon and amino acid next to the
reference's and labels the change synonymous or nonsynonymous.

<Figure src="/img/maf_codon_tooltip.png" caption="The codon-view hover tooltip on the ce11 26-way alignment. Hovering a codon cell reads out the substitution against the reference, so the tooltip names a nonsynonymous change in words."/>

## Getting the alignment out as FASTA

Drag a selection across the track and the menu that opens on release offers
**View subsequences (all rows)**, or **(selected rows)** to take only the rows
the drag covered. Either opens the aligned columns for that window, one sequence
per species, with **Download as FASTA** and **Copy to clipboard** in its menu.
That is the slice a downstream alignment viewer or tree builder wants.

Without a drag, the track menu's **Launch → View subsequences (visible region)**
takes the whole window and every row.

The same menu offers **Show only differences**, which blanks every base matching
the reference so substitutions are all that remain, plus **Include insertions**,
**Single line format**, **Color background**, and **Show sample names**.

A drag crossing a region boundary clips to the region it began in.

## Jumping to a species' own genome

The rows of a MAF carry each species' own coordinates, so a row can be opened in
its own genome. That same menu lists **one entry per species** the selection
covers, naming that species' locus in its own coordinates; clicking one opens a
view there.

Only rows with aligned bases in the selection are listed, and only those whose
sample names a genome the session can open: a sample configured with an
[`assemblyName`](/docs/config_guides/maf_track#the-samples-array), or one whose
id is itself an assembly the session already holds, as the strains of a
[pangenome alignment](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection)
are. If the session does not already hold a configured assembly, JBrowse fetches
just that one at click time, which is what lets a 26-way or 470-way alignment
stay navigable without every species' genome being present in the config. Past
six species the entries move into a submenu.

The track menu's **Launch** submenu lists the same entries over the visible
window, so reaching a species' genome needs no selection.

## Comparing a species against the reference

The same selection — or the visible window, from the track menu's **Launch**
submenu — opens as a two-row
[linear synteny view](/docs/user_guides/linear_synteny_view): **Linear synteny
view, \<ref\> vs...** lists the same species, and picking one opens the
reference over that species' genome with the alignment drawn between them as
ribbons. The ribbons come from the MAF's own columns, so every insertion and
deletion in the block is where the alignment put it, and no synteny file is
involved. The reference row carries the tracks this view had open, the MAF
included; the species row carries its own gene track where the session has one.

<Figure caption="The menu a drag across the rows raises on the E. coli pggb alignment: one entry per strain the drag covers, and the same strains again under the synteny launch." src="/img/maf_row_menu.png" />

## Row layout and the species tree

The sidebar at the left shows the species labels, drawn as a dendrogram when the
track is configured with a Newick guide tree.

- **Show... → Show tree** toggles the dendrogram and **Show row labels** the
  species names, and **Tree branch lengths** draws the tree to scale.
- **Edit row arrangement...** reorders or hand-picks rows.
- **Row height** offers squeeze-to-fit, normal, compact, and custom row heights.

### Selecting a subtree

Click an internal node of the tree to filter the track to that clade, or pick a
set of species from **Edit row arrangement...**. The tree then redraws as the
pruned dendrogram of the kept species, so it matches the visible rows, including
for a selection that is not a single clade. **Clustering → Clear subtree
filter** restores all species.

### Clustering rows by identity

A guide tree states how the genomes are related in general. **Clustering →
Cluster rows by identity...** states how they differ over the window in view:
each row is scored by how much of the window it both aligns and matches the
reference at, where a stretch it does not reach at all scores zero, and
hierarchical clustering over those scores gives the row order and the
dendrogram.

That is the ordering a cohort alignment wants. A file of one species ships no
guide tree, since which haplotypes group together is a property of the locus, so
its rows arrive in the order the file names them. Under an active subtree filter
the run covers the visible rows only, so it resolves the structure inside the
clade.

The submenu names the locus a tree was computed over, since clustering reads the
region in view. **Reset row order** restores the file's own order and the guide
tree with it.

The dialog's manual tab exports the same scores as a TSV with an R script, for
clustering elsewhere and pasting the order back.

## See also

- [MAF track configuration](/docs/config_guides/maf_track)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/gene_track)
- [](/docs/user_guides/quantitative_track) - phyloP/phastCons conservation
  scores as a signal track
- [MAF_LARGE_BLOCKS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MAF_LARGE_BLOCKS.md)
  — why a MAF-tabix track with very long alignment blocks is slow, and why
  clipping to the visible region is the wrong fix

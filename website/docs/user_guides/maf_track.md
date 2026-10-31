---
title: MAF track
description: Viewing multiple alignment format (MAF) data
guide_category: Track types
---

A MAF track shows a multiple sequence alignment of several species (or samples)
against a reference genome: one row per aligned species at its true genomic
position, with a coverage summary on top. It answers "how does this region
compare across many genomes at once", the kind of multiz alignment UCSC
publishes (e.g. the human 470-way or the _C. elegans_ 26-way).

JBrowse reads three formats, MAF (tabix-indexed BED), BigMaf, and bgzipped TAF
(taffy), all opened as a single track. Add one with **File → Open track**, or
load a track an administrator has configured. Data-format and configuration
details (adapters, the species list or Newick guide tree) are in the
[MAF track configuration guide](/docs/config_guides/maf_track). This page covers
what you can do once the track is on screen.

<Figure src="/img/maf_track.png" caption="The UCSC ce11 26-way alignment under the ce11 genes: the coverage band, then one row per species with its differences from the reference."/>

Zoomed out, each pixel summarizes the alignment beneath it. Zoom in and the
per-species rows resolve into individual bases, with positions where a species
differs from the reference drawn as colored marks. The features below come from
three track-menu submenus: **Color by** picks what fills the rows and the
per-base coloring drawn over them, **Plot type** whether they draw as cells or
as identity bars, and **Show** holds the bands and overlays that layer on top of
them.

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
both need the per-base alignment the tier skips reading. Pointing a track at a
summary file is covered in the
[MAF track configuration guide](/docs/config_guides/maf_track#the-zoom-out-tier).

<Figure src="/img/maf_summary_tier.png" caption="The hg38 470-way narrowed to ~30 mammals over GAPDH. At 180 kb (top) the track reads its summary file; at 200 bp (bottom) it draws the alignment."/>

A summary read costs the span on screen against the summary file, not against
the alignment, so the tier holds at whole-chromosome scale on an alignment deep
enough that the tier is the only way to see it at all. The HPRC pangenome is
that case:
[open the whole of chr6](https://jbrowse.org/code/jb2/main/?config=test_data/hprc_maf_summary.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr6%22%2C%22tracks%22%3A%5B%22hprc_v2_1_mc_grch38_summary%22%5D%7D%5D%7D)
and its 464 haplotypes draw with no forced load, where the alignment beneath
them is refused.

## Conservation and per-row identity

The **Show → Conservation** band plots, at each reference base, the fraction of
aligned species whose base matches the reference, a quick read of which regions
are conserved versus divergent. It is computed from the alignment itself, so no
extra files are needed.

The rows work as the [alignments track](/docs/user_guides/alignments_track)'s
reads do: a fill, with the mismatches drawn over it. **Color by** breaks the
same signal out per species, so you can see _which_ genomes diverge in a region.
Its first block picks the fill:

- **Default** fills each row in one tone, the mismatches standing out over it.
- **Identity to reference** shades each row on a red→grey→blue ramp (red
  divergent, blue conserved), a heatmap; its **Color scheme** submenu picks
  another ramp.
- **Source sequence**, below, colors each block by where it comes from in the
  species' own genome.
- **Solid color...** fills the rows in a color you pick.

Its **Per-base coloring** block draws over the fill. **Every base** colors
matching bases by base too, so the whole alignment reads as sequence, and
**Codon changes (amino acids)**, below, colors each codon. Zoomed in, a letter
marks every cell its base colors, in the case the file gives it; UCSC alignments
lowercase soft-masked repeats. **Show → Mismatches** takes the differing bases,
insertion markers and deletion counts off, leaving the fill.

**Plot type** › **Identity X-Y plot** draws identity as each row's bar height, a
per-species wiggle. The bars take the fill: the heatmap's ramp under **Identity
to reference**, and one color under **Default**.

In a display config the fill is [`encoding.color`](/docs/config/mafcolor)
(`identity`, `refNameRank`, or a constant `value`), the per-base coloring
[`alignments.bases`](/docs/config/mafbases), the mismatches
[`alignments.mismatches`](/docs/config/mafmismatches), and the X-Y plot
`encoding.y: "identity"`.

The heatmap's ramp runs from 0 to 100% identity, and
[`encoding.color`](/docs/config/mafcolor) can move it. Close relatives all sit
near its blue end, so
`"color": { "field": "identity", "scale": { "domainMin": 0.7 } }` spreads the
ramp over 70 to 100%, where they differ; `scale.scheme`, `scale.reverse` and
`scale.domainMid` change the ramp itself. The source-sequence colors below take
a `scale.range`, one color per rank.

The heatmap and the X-Y plot draw only while you are zoomed out past base level.
Zooming in to base level swaps them for the default fill and the mismatches,
since a single base's identity is just whether it matches.

The heatmap works on large alignments: with all ~470 species of the UCSC hg38
470-way shown at once, the heatmap gives a per-base conservation view across the
full set of species. Fit-to-display-height mode takes every species into one
display, so each row goes near-1px and the alignment reads as a texture, with
the guide tree (dendrogram) down the left.

<Figure src="/img/maf_470way.png" caption="The hg38 470-way over GAPDH, every species at once."/>

## Color by source sequence

**Source sequence**, in the same **Color by** menu, fills the rows with a
structural view, the mismatches still drawn over it. Within each species row,
the source chromosomes its blocks come from (in that species' own genome) are
ranked by coverage: the row's main chromosome gets the primary color, and blocks
from a different source chromosome take a contrasting accent. A row that stays
one color is collinear; a row that _changes color along its length_ is drawing
blocks from more than one source chromosome, an immediate flag for a
translocation or rearrangement. The ranking is per row, and a compact legend in
the top-right names the scheme (main / 2nd / 3rd source). Like conservation, it
is derived from the alignment with no extra data to fetch. The figure turns off
**Show → Mismatches**, which at this zoom would cover most of the fill.

<Figure src="/img/maf_color_by_chromosome.png" caption="The ce11 26-way colored by source chromosome, a row switching color where its blocks come from another chromosome."/>

## Inversions (strand flips)

**Show → Inversions (strand flips)** overlays a diagonal hatch on any block that
aligns inverted relative to the consensus orientation of its source chromosome.
Each block is compared to its scaffold's consensus, so an arbitrarily-oriented
scaffold reads as collinear and only a genuine intra-scaffold strand flip is
marked. It is an overlay, so it composes on top of any fill and per-base
coloring.

## Codon (amino-acid) view

When the track has a CDS-frames file configured (a UCSC `mafFrames` annotation
on the display), two coding-aware options appear. **CDS frames** (off by
default, under **Show**) draws a thin reading-frame-colored strip on each
species' row, marking the coding exons projected onto that species so the gene
structure reads vertically across the whole alignment. The strip draws over
whatever the rows are colored by, so it works with any **Color by** choice.

**Codon changes (amino acids)**, under **Color by → Per-base coloring**, draws a
per-codon layer over the rows in place of the mismatches: every species is
translated in the reference reading frame, and each codon cell is colored by how
its amino acid compares to the reference. Nonsynonymous changes stand out,
synonymous (silent) changes get a faint tint, a stop the reference does not
share is flagged, and conserved codons, including the gene's stop, show the
fill. The residue is drawn on each codon once you zoom in far enough to read it,
and the layer draws only at base level.

<!-- COLOR_TABLE maf START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#e8930c;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#e8930c"></span> | Nonsynonymous codon | `#e8930c` | MAF codon view: the species' amino acid differs from the reference (nonsynonymous) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#3a7bd5;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#3a7bd5"></span> | Synonymous codon | `#3a7bd5` | MAF codon view: the codon differs from the reference but the amino acid is unchanged (silent) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#cc2222;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#cc2222"></span> | Stop gained | `#cc2222` | MAF codon view: a stop the reference codon is not |

<!-- COLOR_TABLE maf END -->

On a large alignment, narrowing to a focused set of species first (see
[Selecting a subtree](#selecting-a-subtree)) keeps the per-codon columns
legible, and the left sidebar redraws as the pruned guide tree.

<Figure src="/img/maf_470way_codon.png" caption="The hg38 470-way narrowed to representative mammals, with the codon layer on."/>

## Tooltips

Hovering any cell reads out the alignment at that position: the species, its
base, and the location in that species' own genome, plus the alignment status of
the neighboring blocks (e.g. a bridged gap and its size). Insertions, deletions,
and bridged e-line gaps each get a separate tooltip. When the CDS-frames file is
loaded (with the codon layer or the strip on), the hover also shows the gene
name; with the codon layer it shows the species' codon and amino acid next to
the reference's and labels the change synonymous or nonsynonymous.

<Figure src="/img/maf_codon_tooltip.png" caption="The codon-view tooltip, naming the substitution against the reference."/>

## Getting the alignment out as FASTA

Drag a selection across the track and the menu that opens on release offers
**View subsequences → All rows**, or **Selected rows** to take only the rows the
drag covered. Either opens the aligned columns for that window, one sequence per
species, with **Download as FASTA** and **Copy to clipboard** in its menu. That
is the slice a downstream alignment viewer or tree builder wants.

Without a drag, the track menu's **Launch → View subsequences (visible region)**
takes the whole window and every row.

The **View subsequences** menu also offers **Show only differences**, which
blanks every base matching the reference so substitutions are all that remain,
plus **Include insertions**, **Single line format**, **Color background**, and
**Show sample names**.

A drag crossing a region boundary clips to the region it began in.

## Jumping to a species' own genome

Each row of a MAF uses its species' coordinates, so a row can be opened in that
species' genome. The menu a drag raises has an **Open aligned genome at the
matching region** submenu that lists one entry per species the selection covers,
naming the locus in that species' coordinates; clicking one opens a view there.

Only rows with aligned bases in the selection are listed, and only those whose
sample names a genome the session can open: a sample configured with an
[`assemblyName`](/docs/config_guides/maf_track#the-samples-array), or one whose
id is itself an assembly the session already holds, as the strains of a
[pangenome alignment](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection)
are. If the session does not already hold a configured assembly, JBrowse fetches
just that one at click time, so a 26-way or 470-way alignment stays navigable
without every species' genome being present in the config.

The track menu's **Launch** submenu lists the same entries over the visible
window, so reaching a species' genome needs no selection.

## Comparing a species against the reference

A drag-selected span — or the visible window, from the track menu's **Launch**
submenu — opens as a two-row
[linear synteny view](/docs/user_guides/linear_synteny_view): **Linear synteny
view, \<ref\> vs...** lists the same species, and picking one opens the
reference over that species' genome with the alignment drawn between them as
ribbons. The ribbons come from the MAF's own columns, so every insertion and
deletion in the block is where the alignment put it, and no synteny file is
involved. The reference row has the tracks this view had open, the MAF included;
the species row has that species' gene track where the session has one.

<Figure caption="The menu a drag across the rows raises, listing each strain the drag covers." src="/img/maf_row_menu.png" />

## Row layout and the species tree

The sidebar at the left shows the species labels, drawn as a dendrogram when the
track is configured with a Newick guide tree.

- **Show → Tree** toggles the dendrogram and **Row labels** the species names,
  and **Tree branch lengths** draws the tree to scale.
- **Edit row arrangement...** reorders, relabels and recolors rows. The
  display's [`rows`](/docs/config/linearmafdisplay/#slot-rows) setting holds the
  arrangement, so it survives unticking the track and an undo takes it back. Its
  `sort` is the order: with a guide tree it rotates the tree rather than
  overruling it, each node putting the clade holding the earliest listed species
  first, so a listed species comes as early as the topology allows and brings
  its relatives with it — `["mm10"]` on `((hg38,panTro4),mm10)` draws mouse's
  branch at the top. With no guide tree the listed species simply lead. The tree
  draws while some rotation of it lists the species in `sort`'s order, so a
  reorder that splits a clade hides it until **Reset row order** brings it back,
  and one that only turns a clade keeps it.
- The species rows always share the track's height between them, so more species
  make thinner rows. Drag the track taller, or select a subtree, to read the
  bases on fewer, taller rows.

### Selecting a subtree

Click an internal node of the tree to filter the track to that clade, or pick a
set of species from **Edit row arrangement...**. The tree then redraws as the
pruned dendrogram of the kept species, so it matches the visible rows, including
for a selection that is not a single clade. **Clustering → Clear subtree
filter** restores all species. The focus is `rows.kept`. On a track whose
species come from a `samples` array or a Newick tree, a focus naming none of
them shows every row; on one that finds its species in the alignment blocks, it
shows only the species it names, so none where the alignment holds none of them.

### Clustering rows by identity

A guide tree records how the genomes are related in general. **Clustering →
Cluster rows by identity...** clusters rows by how they differ over the window
in view: it scores each row by how much of the window the row both aligns and
matches the reference at, where a stretch it does not reach at all scores zero,
and hierarchical clustering over those scores gives the row order and the
dendrogram.

A cohort alignment wants exactly this ordering. A file of one species ships no
guide tree, since which haplotypes group together is a property of the locus, so
its rows arrive in the order the file names them. Under an active subtree filter
the run covers the visible rows only, so it resolves the structure inside the
clade.

The submenu names the locus a tree was computed over, since clustering reads the
region in view. The run rotates its tree towards the current `rows.sort`, a
declared order or an earlier reorder, so it composes with that order instead of
replacing it. **Reset row order** restores the declared order, and the guide
tree with it where a rotation of the tree lists that order.

The dialog's manual tab exports the same scores as a TSV with an R script, for
clustering elsewhere and pasting the order back.

## See also

- [MAF track configuration](/docs/config_guides/maf_track)
- [](/docs/config_guides/mark_display) - a row per species drawn as declared
  marks, off a `flatten` over each block's `alignments`
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/gene_track)
- [](/docs/user_guides/quantitative_track) - phyloP/phastCons conservation
  scores as a signal track
- [MAF_LARGE_BLOCKS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MAF_LARGE_BLOCKS.md)
  — why a MAF-tabix track with very long alignment blocks is slow, and why
  clipping to the visible region is the wrong fix

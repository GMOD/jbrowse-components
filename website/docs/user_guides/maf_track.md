---
title: MAF track
description: Viewing multiple alignment format (MAF) data
guide_category: Track types
---

A MAF track shows a multiple sequence alignment of several species (or samples)
against a reference genome: one row per aligned species at its true genomic
position, with a coverage summary on top. Use it to compare a region across many
genomes at once, as in the multiz alignments UCSC publishes (e.g. the human
470-way or the _C. elegans_ 26-way).

JBrowse reads three formats, MAF (tabix-indexed BED), BigMaf, and bgzipped TAF
(taffy), all opened as a single track. Add one with **File → Open track**, or
load a track an administrator has configured. Data-format and configuration
details (adapters, the species list or Newick guide tree) are in the
[MAF track configuration guide](/docs/config_guides/maf_track).

<Figure src="/img/maf_track.png" caption="The UCSC ce11 26-way alignment under the ce11 genes: the coverage band, then one row per species with its differences from the reference."/>

Zoomed out, each pixel summarizes the alignment beneath it. Zoom in and the
per-species rows resolve into individual bases, with positions where a species
differs from the reference drawn as colored marks. The features below come from
these track-menu submenus:

- **Color by** picks what fills the rows and the per-base coloring drawn over
  them
- **Plot type** picks whether they draw as cells or as identity bars
- **Show** holds the bands and overlays that layer on top of them

## Zooming out past the alignment

Zoomed out on a deep alignment, the track stops with a "requested too much data"
prompt, because each block holds the sequences of all its species. A track
configured with a summary file
([how](/docs/config_guides/maf_track#the-zoom-out-tier)) shows presence bars
there instead:

- **Bars:** one per species per aligned region, shaded by the summary's score
- **Hover** names the species, the aligned block and its score, which is how to
  identify a row once the labels are too small to read
- **No bands:** the coverage and conservation bands are not drawn on this tier
- **Zooming back in** swaps the bars for the alignment itself

<Figure src="/img/maf_summary_tier.png" caption="The hg38 470-way narrowed to ~30 mammals over GAPDH. At 180 kb (top) the track reads its summary file; at 200 bp (bottom) it draws the alignment."/>

The summary tier draws at whole-chromosome scale even on an alignment too deep
to load: on the HPRC pangenome,
[open the whole of chr6](https://jbrowse.org/code/jb2/main/?config=test_data/hprc_maf_summary.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr6%22%2C%22tracks%22%3A%5B%22hprc_v2_1_mc_grch38_summary%22%5D%7D%5D%7D)
and its haplotypes draw with no forced load.

## Conservation and per-row identity

The **Show → Show conservation** band plots, at each reference base, the
fraction of aligned species whose base matches the reference. It is computed
from the alignment itself, so no extra files are needed.

Like the [alignments track](/docs/user_guides/alignments_track)'s reads, each
row is a fill with the mismatches drawn over it. **Color by** breaks the same
signal out per species. Its first block picks the fill:

- **Default** fills each row in one tone, the mismatches standing out over it.
- **Identity to reference** shades each row on a red→grey→blue ramp (red
  divergent, blue conserved), a heatmap; its **Color scheme** submenu picks
  another ramp.
- **Source sequence**, below, colors each block by where it comes from in the
  species' own genome.
- **Solid color...** fills the rows in a color you pick.

Drawn over the fill:

- **Every base**, in the **Per-base coloring** block of the same menu, colors
  matching bases by base too, so the whole alignment reads as sequence; **Codon
  changes (amino acids)** ([below](#codon-amino-acid-view)) colors each codon
- **Letters:** zoomed in, a letter marks every cell its base colors, in the case
  the file gives it (UCSC alignments lowercase soft-masked repeats)
- **Show → Show mismatches** takes the differing bases, insertion markers and
  deletion counts off, leaving the fill

**Plot type** › **Identity X-Y plot** draws identity as each row's bar height, a
per-species wiggle, colored with the heatmap's ramp under **Identity to
reference** and with one color under **Default**. The heatmap and the X-Y plot
draw only while zoomed out past base level; at base level the rows take the
default fill and the mismatches.

In a display config:

- **Fill:** [`encoding.color`](/docs/config/mafcolor) (`identity`,
  `refNameRank`, or a constant `value`)
- **Per-base coloring:** [`alignments.bases`](/docs/config/mafbases)
- **Mismatches:** [`alignments.mismatches`](/docs/config/mafmismatches)
- **X-Y plot:** `encoding.y: "identity"`
- **Ramp:** runs from 0 to 100% identity, and close relatives all sit near its
  blue end, so `"color": { "field": "identity", "scale": { "domainMin": 0.7 } }`
  spreads it over 70 to 100%. `scale.scheme`, `scale.reverse` and
  `scale.domainMid` change the ramp; the source-sequence colors take a
  `scale.range`, one color per rank

With every species of the UCSC hg38 470-way shown at once, fit-to-display-height
mode takes each row to near 1px, and the heatmap reads as a texture beside the
guide tree.

<Figure src="/img/maf_470way.png" caption="The hg38 470-way over GAPDH, every species at once."/>

## Color by source sequence

**Source sequence**, in the same **Color by** menu, colors each block by the
chromosome it comes from in that species' own genome, the mismatches still drawn
over it:

- **Ranking:** per row, by coverage; the row's main chromosome takes the primary
  color and blocks from another chromosome a contrasting accent. A legend in the
  top-right names the ranks (main / 2nd / 3rd source)
- **Color changes:** a row that stays one color is collinear; a row that changes
  color along its length draws blocks from more than one chromosome, which flags
  a translocation or rearrangement

The figure turns off **Show → Show mismatches**, which at this zoom would cover
most of the fill.

<Figure src="/img/maf_color_by_chromosome.png" caption="The ce11 26-way colored by source chromosome, a row switching color where its blocks come from another chromosome."/>

## Inversions (strand flips)

**Show → Show inversions (strand flips)** overlays a diagonal hatch on any block
that aligns inverted relative to the consensus orientation of its source
chromosome, so a scaffold that is reversed as a whole is not marked. It draws on
top of any fill and per-base coloring.

## Codon (amino-acid) view

A track with a CDS-frames file configured (a UCSC `mafFrames` annotation on the
display) has two coding-aware options:

- **Show CDS frames** (off by default, under **Show**) draws a thin
  reading-frame-colored strip on each species' row, marking the coding exons
  projected onto that species, over any **Color by** choice
- **Codon changes (amino acids)**, in the **Per-base coloring** block of **Color
  by**, replaces the mismatches with a per-codon layer: every species is
  translated in the reference reading frame and each codon is colored by how its
  amino acid compares to the reference. Conserved codons, including the gene's
  stop, show the fill. The layer draws only at base level, with the residue
  written on each codon once there is room

<!-- BEGIN GENERATED COLOR_TABLE maf -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#e8930c;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#e8930c"></span> | Nonsynonymous codon | `#e8930c` | MAF codon view: the species' amino acid differs from the reference (nonsynonymous) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#3a7bd5;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#3a7bd5"></span> | Synonymous codon | `#3a7bd5` | MAF codon view: the codon differs from the reference but the amino acid is unchanged (silent) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#cc2222;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#cc2222"></span> | Stop gained | `#cc2222` | MAF codon view: a stop the reference codon is not |

<!-- END GENERATED COLOR_TABLE maf -->

On a large alignment, [select a subtree](#selecting-a-subtree) first to keep the
codon columns legible.

<Figure src="/img/maf_470way_codon.png" caption="The hg38 470-way narrowed to representative mammals, with the codon layer on."/>

## Tooltips

Hovering a cell names the species, its base and the location in that species'
own genome, plus the alignment status of the neighboring blocks (e.g. a bridged
gap and its size). Insertions, deletions, and bridged e-line gaps each get their
own tooltip. With the CDS-frames strip or codon layer on, the hover adds the
gene name; with the codon layer, the species' codon and amino acid beside the
reference's, labelled synonymous or nonsynonymous.

<Figure src="/img/maf_codon_tooltip.png" caption="The codon-view tooltip, naming the substitution against the reference."/>

## Getting the alignment out as FASTA

Drag a selection across the track and the menu that opens on release offers
**View subsequences → All rows**, or **Selected rows** to take only the rows the
drag covered. Either opens the aligned columns for that window, one sequence per
species, with **Download as FASTA** and **Copy to clipboard** in its menu.
Without a drag, the track menu's **Launch → View subsequences (visible region)**
takes the whole window and every row. A drag crossing a region boundary clips to
the region it began in.

The **View subsequences** menu also offers **Show only differences**, which
blanks every base matching the reference, plus **Include insertions**, **Single
line format**, **Color background**, and **Show sample names**.

## Jumping to a species' own genome

The menu a drag raises has an **Open aligned genome at the matching region**
submenu, one entry per species the selection covers, naming the locus in that
species' coordinates; clicking one opens a view there. The track menu's
**Launch** submenu lists the same entries over the visible window.

A species is listed when it has aligned bases in the selection and its sample
names a genome the session can open: a sample configured with an
[`assemblyName`](/docs/config_guides/maf_track#the-samples-array), or one whose
id is itself an assembly the session holds, as the strains of a
[pangenome alignment](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection)
are. A configured assembly the session has not loaded is fetched at click time.

## Comparing a species against the reference

A drag-selected span — or the visible window, from the track menu's **Launch**
submenu — opens as a two-row
[linear synteny view](/docs/user_guides/linear_synteny_view): **Linear synteny
view, \<ref\> vs** lists the same species, and picking one opens the reference
over that species' genome with the ribbons drawn from the MAF's columns, so no
synteny file is needed. The reference row has the tracks this view had open, the
MAF included; the species row has that species' gene track where the session has
one.

<Figure caption="The menu a drag across the rows raises, listing each strain the drag covers." src="/img/maf_row_menu.png" />

## Row layout and the species tree

The sidebar at the left shows the species labels, drawn as a dendrogram when the
track is configured with a Newick guide tree.

- **Show → Show tree** toggles the dendrogram and **Show row labels** the
  species names, and **Show tree branch lengths** draws the tree to scale.
- **Edit row arrangement...** reorders, relabels and recolors rows. The
  arrangement is the display's
  [`rows`](/docs/config/linearmafdisplay/#slot-rows) setting, so it survives
  unticking the track and an undo takes it back.
- **Order with a tree:** a guide tree rotates so the species listed first come
  as early as the topology allows, bringing their relatives (`["mm10"]` as
  `sort` on `((hg38,panTro4),mm10)` draws mouse's branch at the top). A reorder
  that splits a clade hides the tree until **Reset row order**.
- **Row height:** the species rows share the track's height, so more species
  make thinner rows. Drag the track taller, or select a subtree, for fewer,
  taller rows.

### Selecting a subtree

Click an internal node of the tree to filter the track to that clade, or pick a
set of species from **Edit row arrangement...**. The tree redraws as the pruned
dendrogram of the kept species, and **Clustering → Show all rows** restores them
all. The focus is stored in `rows.kept`.[^kept]

### Clustering rows by identity

**Clustering → Cluster rows by identity...** orders the rows, and draws a
dendrogram, by how much of the window in view each row aligns and matches the
reference at. It suits a cohort alignment, such as one species' haplotypes, that
has no guide tree.

- **Scope:** the run reads the region in view, and the submenu names that locus.
  Under a subtree filter it covers the visible rows only
- **Order:** the result rotates towards the current `rows.sort`, and **Reset row
  order** restores the declared order (and the guide tree, where a rotation of
  it lists that order)
- **Elsewhere:** the dialog's manual tab exports the scores as a TSV with an R
  script, for clustering outside JBrowse and pasting the order back

## See also

- [MAF track configuration](/docs/config_guides/maf_track)
- [](/docs/config_guides/mark_display) - a row per species drawn as declared
  marks, off a `flatten` over each block's `alignments`
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/gene_track)
- [](/docs/user_guides/quantitative_track) - phyloP/phastCons conservation
  scores as a signal track
- [](/docs/tutorials/genomes_basics)

[^kept]:
    On a track whose species come from a `samples` array or a Newick tree, a
    focus naming none of them shows every row; on a track that reads its species
    from the alignment blocks, the focus shows the species it names, and no rows
    where the alignment has none of them.

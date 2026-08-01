---
title: Single-cell RNA pseudobulk
description:
  Aggregate single-cell RNA into per-cell-type coverage BigWigs, and link them
  to a UMAP
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

**TL;DR:** pool each cluster's cells into one coverage BigWig outside JBrowse,
load the set as a single MultiWiggle track, and the browser shows one row per
cell type. The same clustering also drives an embedded UMAP that filters those
rows.

## Prerequisites

To build the tracks:

- cells already clustered and labeled, plus the barcoded BAM the counts came
  from (Cell Ranger's `possorted_genome_bam.bam`, or any BAM carrying a
  corrected cell-barcode tag)
- `bedGraphToBigWig` from the UCSC utilities, or deepTools
- a JBrowse instance to load the finished BigWigs into

## What a genome browser adds

A UMAP answers how much of a gene each cell type made. It cannot show where in
the gene the reads landed, and that is the part a browser puts back: which end,
which exons, which annotated transcript the pile actually agrees with.

<Figure caption="Nine per-cell-type BigWigs from the 10x 5k PBMC dataset over LYZ, loaded as one MultiQuantitativeTrack. The two monocyte rows and the cDC row carry the pile, the lymphocyte rows are flat, and the pile sits at the 3' end of the gene rather than across it." src="/img/scrna/lyz_monocyte.png" />

The pile at one end is not a defect. 10x 3' chemistry sequences the 3' end of
each transcript, so a coverage track of that library is a spike near the
polyadenylation site and very little else. Reading a marker gene means comparing
the heights of those spikes across rows, which is the same comparison a dot plot
makes, drawn on the coordinate where the reads actually are. Full-length
chemistries (Smart-seq, and 5' kits to a lesser degree) spread coverage over the
gene body instead, and the rest of this page applies unchanged.

## Generating per-cell-type BigWigs

Clustering and labeling stay upstream, in Seurat, scanpy, or whatever produced
the annotation. This page starts from a barcode-to-label table and the BAM.

Two decisions determine whether the rows can be compared to each other.

**Duplicates.** Cell Ranger flags PCR duplicates of the same UMI with the
standard `0x400` flag. Keeping them makes a row's height track amplification
rather than expression, so filter them out. Restricting to uniquely mapped reads
(`MAPQ` 255, which is what STAR emits inside Cell Ranger) drops the multimappers
that would otherwise pile onto paralogs.

**Normalization.** Cell types differ in cell count and in sequencing depth, so
each pooled track needs scaling (CPM is the usual choice) before one row's
height means anything next to another's. Without it a tall row can just mean
more cells went into it.

Coverage must also be splice-aware: an RNA read spanning an intron carries an
`N` in its CIGAR, and counting that as covered fills in introns that no read
touched.

The familiar route is to split the BAM by label with
[`sinto filterbarcodes`](https://timoast.github.io/sinto/basic_usage.html) and
run
[`bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
on each output with
`--samFlagExclude 1024 --minMappingQuality 255 --normalizeUsing CPM`. That
writes a second copy of the BAM to disk, split N ways.

[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh)
takes the other route: it reads the BAM by region straight over HTTPS,
accumulating each cell type's coverage in one pass, so nothing is downloaded and
nothing is split. For a 23GB BAM that is the difference between needing scratch
space and needing none.

## Loading the BigWigs

One `MultiQuantitativeTrack` holds the whole set, one `BigWigAdapter` subadapter
per cell type, each carrying the row's `name`, `color`, and `group`. That
config, the `--multiwig` CLI form, and the add-track UI workflow are all covered
on [](/docs/tutorials/scatac_pseudobulk), which loads an ATAC set the same way;
nothing about the RNA case differs.

Take the row order and the row colors from the single-cell object rather than
from the filesystem. Related lineages stay adjacent instead of alphabetized, and
a row keeps the color its cluster had on the UMAP, which is what lets a reader
move between the two pictures.

## One row per cell

A pseudobulk row is a sum over thousands of cells, and it draws that sum as a
smooth curve. The cells themselves can go under it, one row each, read from a
cells-by-bins Zarr matrix instead of one file per cell.

<Figure caption="The nine pseudobulk rows at LYZ above the 4390 cells they are a sum over, ordered by cell type and colored to match. The monocyte and dendritic blocks are solid; the lymphocyte blocks are speckle, one UMI per cell." src="/img/scrna/percell_lyz.png" />

<Figure caption="The same store at MS4A1, on a lower pinned maximum. The block that carried LYZ is empty and the B block is the one that fills, so the pattern moves with the lineage rather than being a property of one window." src="/img/scrna/percell_ms4a1.png" />

The speckle is the point. Above, the lymphocyte rows look like a low flat line
next to the monocyte peak, which reads as silence. Per cell it is not silence: a
third of those cells carry exactly one UMI of a monocyte gene, which is ambient
RNA in the droplet rather than transcription in the cell. Summing hides that;
one row per cell shows it.

Two settings make this legible and skipping either one wastes the figure.

**Order the rows by cell type.** 4390 rows in a few hundred pixels is well under
a pixel each, so the picture is a raster rather than readable rows, and the only
way a block means anything is if the cells in it are adjacent. The `group` on
each row seeds that, and it also drives the sidebar tree.

**Pin the score axis.** With autoscale the maximum is whatever the home cell
type reached, which at LYZ is hundreds of UMIs in a single monocyte. Every
single-UMI cell then renders white and the ambient signal disappears. A pinned
`minScore: 0` and a low `maxScore` puts one UMI a visible fraction up the ramp
and lets the home block saturate, which is the same reasoning as the copy-number
heatmap in [](/docs/tutorials/population_cnv).

The store is read by the `MultiWiggleZarrAdapter` that
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr) adds,
the same adapter [](/docs/tutorials/population_cnv) uses for 2504 individuals of
the 1000 Genomes panel. Its bin axis lays each window end to end keyed by
refName, so it holds one window per chromosome; the marker genes it covers are
picked to sit on different chromosomes for that reason. Per-cell coverage only
says anything at a locus the cells actually have reads at, so covering marker
windows rather than the genome is the whole design, and it is why the store is
under a megabyte.

## Both assays over one locus

Because the rows are just BigWigs, an RNA set and an ATAC set stack in one view.

<Figure caption="The RNA rows above the scATAC rows at MS4A1, both from the same PBMCs. The RNA rows say which cell types transcribed the gene; the ATAC rows say where the locus is open, including the promoter that the RNA spike is nowhere near." src="/img/scrna/rna_atac_ms4a1.png" />

The two assays disagree about where the interesting coordinate is, which is the
point of looking at them together: accessibility marks the promoter and the
enhancers, and 3' RNA marks the far end of the transcript.

## Linking the UMAP to the tracks

The
[single-cell UMAP example](https://jbrowse.org/storybook/lgv/single-cell-umap)
puts a UMAP beside this track in an embedded view and wires the two together.
Selecting cell types calls the display's own row filter:

```ts
display.setSubtreeFilter(['CD8 T', 'NK'])
```

Filtering also tightens the shared score axis onto the visible rows, so two cell
types compared against each other are not left short against a maximum set by a
row that is no longer drawn. Clicking a gene in the track goes the other way and
recolors the cells by that gene's expression, read from `session.selection` with
no click handler.

## Reproduce it end to end

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_scrna_pseudobulk.sh
bash build_scrna_pseudobulk.sh    # builds ./scrna_pseudobulk_build
npx --yes serve scrna_pseudobulk_build/jbrowse2
```

Its input is 10x Genomics' public 5k PBMC v3 dataset. The script runs the
standard scanpy pipeline on the filtered count matrix (QC, normalize, PCA,
neighbors, UMAP, Leiden), labels each cluster by scoring it against canonical
PBMC marker panels, and prints the whole score matrix so the labels can be
checked rather than trusted. It then pseudobulks the BAM against those labels
and writes the finished JBrowse instance, plus the UMAP's own data files.

Cluster labels are the one step with real judgment in it. A cluster whose best
panel score is weak is labeled unassigned rather than folded into the nearest
lineage, which is the honest outcome for the low-count cluster a PBMC run
usually produces.

## See also

- [](/docs/tutorials/scatac_pseudobulk)
- [Multi-quantitative track configuration](/docs/config_guides/multiquantitative_track)
- [MultiWiggleAdapter config](/docs/config/multiwiggleadapter)
- [](/docs/user_guides/clustering)

## Sources

- [10x Genomics 5k PBMC v3](https://www.10xgenomics.com/datasets/5-k-peripheral-blood-mononuclear-cells-pbm-cs-from-a-healthy-donor-v-3-chemistry-3-standard-3-0-2),
  the dataset this page pseudobulks
- [scanpy's clustering tutorial](https://scanpy.readthedocs.io/en/stable/tutorials/basics/clustering.html),
  the pipeline the build script follows
- [sinto `filterbarcodes`](https://timoast.github.io/sinto/basic_usage.html) and
  [deepTools `bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
  for the split-the-BAM route

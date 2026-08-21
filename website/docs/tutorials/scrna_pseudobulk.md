---
title: Single-cell RNA pseudobulk
description:
  Aggregate single-cell RNA into per-cell-type coverage BigWigs, and link them
  to a UMAP
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
data: pipeline
---

**TL;DR:** pool each cluster's cells into one coverage BigWig outside JBrowse,
load the set as a single MultiWiggle track, and the browser shows one row per
cell type. The same clustering also drives an embedded UMAP that filters those
rows.

## Prerequisites

- cells already clustered and labeled, plus the barcoded BAM the counts came
  from (Cell Ranger's `possorted_genome_bam.bam`, or any BAM carrying a
  corrected cell-barcode tag)
- [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) from the UCSC
  utilities, or `pip install deeptools sinto` plus `samtools` for the
  split-the-BAM route; the [reproduce script](#reproduce-it-end-to-end) bins the
  reads itself, so it needs `bedGraphToBigWig` but neither of the other two
- a JBrowse instance to load the finished BigWigs into (see the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop))

## What the tracks show

A UMAP or a dot plot gives you how much of a gene each cell type made. Putting
the same cells on genomic coordinates adds where in the gene the reads landed:
which end, which exons, which annotated transcript the pile agrees with.

<Figure caption="Nine per-cell-type BigWigs from the 10x 5k PBMC dataset, loaded as one MultiQuantitativeTrack, over nine marker loci in one discontinuous view, in the same order as the rows they mark. The signal walks down the diagonal." src="/img/scrna/marker_panel.png" />

The signal piling up at one end of each gene is the chemistry showing through:
10x 3' kits sequence the 3' end of each transcript, so a coverage track of that
library is a spike near the polyadenylation site and very little else. Reading a
marker gene means comparing the heights of those spikes across rows. The figure
is on a log scale because the rows share one axis and the brightest marker sits
well above the dimmest. Full-length chemistries (Smart-seq, and 5' kits to a
lesser degree) spread coverage over the gene body instead, and the rest of this
page applies unchanged.

## Generating per-cell-type BigWigs

Clustering and labeling stay upstream, in Seurat, scanpy, or whatever produced
the annotation. This page starts from a barcode-to-label table and the BAM.

Two decisions determine whether the rows can be compared to each other, and both
are about what goes into a row rather than how it is drawn:

- **Duplicates.** Cell Ranger flags PCR duplicates of the same UMI with the
  standard `0x400` flag. Keeping them makes a row's height track amplification
  rather than expression, so filter them out. Restricting to uniquely mapped
  reads (`MAPQ` 255, which is what STAR emits inside Cell Ranger) drops the
  multimappers that would otherwise pile onto paralogs.
- **Normalization.** Cell types differ in cell count and in sequencing depth, so
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
on each output:

```bash
# barcodes.tsv is two columns: cell barcode, cell-type label
sinto filterbarcodes -b possorted_genome_bam.bam -c barcodes.tsv -p 8
for bam in *.bam; do
  samtools index "$bam"
  bamCoverage -b "$bam" -o "${bam%.bam}.bw" \
    --samFlagExclude 1024 --minMappingQuality 255 --normalizeUsing CPM
done
```

`--samFlagExclude 1024` is the duplicate filter and `--minMappingQuality 255`
the unique-mapping one, the two decisions above. That writes a second copy of
the BAM to disk, split N ways.

[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh)
takes the other route: it reads the BAM by region straight over HTTPS,
accumulating each cell type's coverage in one pass, so nothing is downloaded and
nothing is split. On a BAM the size this one is, that is the difference between
needing scratch space and needing none.

## Loading the BigWigs

One `MultiQuantitativeTrack` holds the whole set, one `BigWigAdapter` subadapter
per cell type, each carrying the row's `name`, `color`, and `group`. The
figure's nine rows are nine such entries; here are the first three:

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "pbmc5k_scrna_pseudobulk",
  "name": "scRNA pseudobulk by cell type (10x 5k PBMC)",
  "category": ["Single cell", "Expression"],
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "CD4 T",
        "group": "T cell",
        "color": "#1f77b4",
        "uri": "https://example.com/bw/CD4_T.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CD8 T",
        "group": "T cell",
        "color": "#279e68",
        "uri": "https://example.com/bw/CD8_T.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CD14 Mono",
        "group": "Monocyte",
        "color": "#8c564b",
        "uri": "https://example.com/bw/CD14_Mono.bw"
      }
    ]
  },
  "displayDefaults": {
    "defaultRendering": "multirowxy",
    "height": 330
  }
}
```

Take the row order and the row colors from the single-cell object rather than
from the filesystem, so related lineages stay adjacent instead of alphabetized
and a row keeps the color its cluster had on the UMAP, which is what lets a
reader move between the two pictures.

The `--multiwig` CLI form and the add-track UI workflow build the same track
without hand-writing it, and both are covered on
[](/docs/tutorials/scatac_pseudobulk), which loads an ATAC set the same way;
nothing about the RNA case differs.

## One row per cell

A pseudobulk row is a sum over thousands of cells, and it draws that sum as a
smooth curve. The cells themselves can go under it, one row each, read from a
cells-by-bins Zarr matrix instead of one file per cell.

<Figure caption="The nine pseudobulk rows at LYZ above the individual cells they are a sum over, ordered by cell type and colored to match. The monocyte and dendritic blocks are solid; the lymphocyte blocks are speckle, one UMI per cell." src="/img/scrna/percell_lyz.png" />

The speckle is what the pseudobulk row above cannot show. Summed, the lymphocyte
rows are a low flat line next to the monocyte peak; per cell, many of those
cells carry a single UMI of a monocyte gene, which is ambient RNA in the droplet
rather than transcription in the cell.

Two settings decide whether that is visible at all:

- **Order the rows by cell type.** Thousands of rows in a few hundred pixels is
  well under a pixel each, so a block only means anything if the cells in it are
  adjacent. The `group` on each row seeds that, and it also drives the sidebar
  tree.
- **Pin the score axis.** With autoscale the maximum is whatever the home cell
  type reached, which at LYZ is a single monocyte far above everything else, and
  every single-UMI cell renders white against it. A pinned `minScore: 0` and a
  low `maxScore` puts one UMI a visible fraction up the ramp, the same reasoning
  as the copy-number heatmap in [](/docs/tutorials/population_cnv).

The store is read by the `MultiWiggleZarrAdapter` that
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr) adds,
the same adapter [](/docs/tutorials/population_cnv) uses for 2504 individuals of
the 1000 Genomes panel. Declaring the plugin and pointing a track at the store
is the whole config; the cell list, the bin size and the row colors are
attributes of the store, written by the build step:

```json
{
  "plugins": [
    {
      "name": "Zarr",
      "url": "https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js"
    }
  ],
  "tracks": [
    {
      "type": "MultiQuantitativeTrack",
      "trackId": "pbmc5k_scrna_percell",
      "name": "Per-cell coverage (marker loci)",
      "category": ["Single cell"],
      "assemblyNames": ["hg38"],
      "adapter": {
        "type": "MultiWiggleZarrAdapter",
        "uri": "percell.zarr"
      },
      "displayDefaults": {
        "defaultRendering": "multirowdensity",
        "minScore": 0,
        "maxScore": 2,
        "height": 420
      }
    }
  ]
}
```

A relative `uri` resolves against the config that holds it, so a store sitting
beside `config.json` needs no absolute URL, and nothing runs on the server.

The store's bin axis lays each window end to end keyed by refName, so it holds
one window per chromosome; the marker genes it covers are picked to sit on
different chromosomes for that reason. Per-cell coverage only says anything at a
locus the cells actually have reads at, so covering marker windows rather than
the genome is the whole design, and it is why the store is under a megabyte.

Because the rows are just signal, an RNA set and an ATAC set stack in one view:
the demo config carries a pseudobulk scATAC set over the same PBMCs beside the
RNA one, and the two assays disagree about where the interesting coordinate is.

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
checked against it. It then pseudobulks the BAM against those labels and writes
the finished JBrowse instance, plus the UMAP's own data files.

Cluster labels are the one step with real judgment in it. A cluster whose best
panel score is weak is labeled unassigned rather than folded into the nearest
lineage, which is what usually happens to the low-count cluster a PBMC run
produces.

## See also

- [](/docs/tutorials/scatac_pseudobulk)
- [](/docs/tutorials/rnaseq)
- [](/docs/config_guides/multiquantitative_track)
- [](/docs/config/multiwiggleadapter)
- [](/docs/user_guides/clustering)

## References

- [10x Genomics 5k PBMC v3](https://www.10xgenomics.com/datasets/5-k-peripheral-blood-mononuclear-cells-pbm-cs-from-a-healthy-donor-v-3-chemistry-3-1-standard-3-0-2),
  the dataset this page pseudobulks
- [scanpy's clustering tutorial](https://scanpy.readthedocs.io/en/stable/tutorials/basics/clustering.html),
  the pipeline the build script follows
- [sinto `filterbarcodes`](https://timoast.github.io/sinto/basic_usage.html) and
  [deepTools `bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
  for the split-the-BAM route

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

## Where the data comes from

10x Genomics'
[5k PBMC v3](https://www.10xgenomics.com/datasets/5-k-peripheral-blood-mononuclear-cells-pbm-cs-from-a-healthy-donor-v-3-chemistry-3-1-standard-3-0-2)
experiment, streamed and pooled by cell type without landing on disk.

- the barcoded alignments, read by region over HTTPS rather than downloaded:
  https://cf.10xgenomics.com/samples/cell-exp/3.0.2/5k_pbmc_v3/5k_pbmc_v3_possorted_genome_bam.bam
- the filtered feature-barcode matrix the clustering runs on:
  https://cf.10xgenomics.com/samples/cell-exp/3.0.2/5k_pbmc_v3/5k_pbmc_v3_filtered_feature_bc_matrix.h5

## Where in the gene the reads land

Putting the cells on genomic coordinates says where in the gene the reads
landed: which end, which exons, which annotated transcript. 10x 3' kits sequence
the 3' end of each transcript, so their coverage is a spike near the
polyadenylation site. Full-length chemistries (Smart-seq, and 5' kits to a
lesser degree) spread coverage over the gene body.

## Generating per-cell-type BigWigs

Clustering and labeling stay upstream, in Seurat, scanpy, or whatever produced
the annotation. This page starts from a barcode-to-label table and the BAM.

Two decisions determine whether the rows can be compared:

- **Duplicates.** Cell Ranger flags PCR duplicates of the same UMI with `0x400`;
  filter them out so a row's height tracks expression. Restricting to uniquely
  mapped reads (`MAPQ` 255, what STAR emits inside Cell Ranger) keeps
  multimappers off paralogs
- **Normalization.** Cell types differ in cell count and depth, so each pooled
  track needs scaling (CPM is usual) before one row's height means anything next
  to another's

Coverage must also be splice-aware: a read spanning an intron carries an `N` in
its CIGAR, and counting that as covered fills in introns no read touched.

One route splits the BAM by label with
[`sinto filterbarcodes`](https://timoast.github.io/sinto/basic_usage.html) and
runs
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
the unique-mapping one. This writes a second copy of the BAM to disk, split N
ways.

[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh)
instead reads the BAM by region over HTTPS, accumulating each cell type's
coverage in one pass with no download, split or scratch space. Either way the
last step is where the normalization lands:

<!-- from: scripts/build_scrna_pseudobulk.sh -->

```bash
# CPM: scale by 1e6 / this cell type's own read total, so a row from 200 cells
# compares with one from 2,000
awk -v total="$reads" -v OFS='\t' \
  '{print $1, $2, $3, $4 * 1e6 / total}' celltype.bg > celltype.cpm.bg

# chromosomes in the chrom.sizes' own order, which for UCSC names is
# lexicographic (chr1, chr10, ... chr2) and not the order reads stream in
bedGraphToBigWig celltype.cpm.bg hg38.chrom.sizes celltype.bw
```

One pass over a chromosome fills a row per cell type. The two decisions are the
two `continue`s, and the splice-awareness is `get_blocks`:

<!-- from: scripts/build_scrna_pseudobulk.sh -->

```python
# of_barcode maps a corrected cell barcode to its cell type's row index
bam = pysam.AlignmentFile(BAM, "rb", index_filename=bai)
length = bam.get_reference_length(chrom)
cov = np.zeros((len(types), length // BIN + 1), dtype=np.uint32)

for read in bam.fetch(chrom):
    # 0x400 is the duplicate flag, 0x100 secondary and 0x800 supplementary. The
    # first is the duplicate decision; the other two stop one read landing in
    # several places at once. MAPQ 255 is what STAR emits for a unique
    # alignment, which is the only kind CellRanger writes.
    if read.flag & SKIP_FLAGS or read.mapping_quality < MIN_MAPQ:
        continue
    try:
        t = of_barcode[read.get_tag("CB")]
    except KeyError:
        continue  # a cell the labeling dropped, or an uncorrected barcode
    # get_blocks splits the read at every N in its CIGAR, so an intron the read
    # spans stays a gap instead of filling in
    for start, end in read.get_blocks():
        cov[t][start // BIN : (end - 1) // BIN + 1] += 1
```

Each row is written out as a bedGraph, scaled by
`1e6 / <that cell type's counted reads>`, and converted:

<!-- from: scripts/build_scrna_pseudobulk.sh -->

```bash
bedGraphToBigWig CD8_T.all.bg hg38.chrom.sizes bw/CD8_T.bw
```

## Loading the BigWigs

One `MultiQuantitativeTrack` holds the set, one `BigWigAdapter` subadapter per
cell type with its `name`, `color`, and `group`. The first three of the nine
rows in the figure below:

```json addtrack
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

Take the row order and colors from the single-cell object, so related lineages
stay adjacent and a row keeps the color its cluster had on the UMAP.

<Figure caption="Nine per-cell-type BigWigs from the 10x 5k PBMC dataset, loaded as one MultiQuantitativeTrack, over nine marker loci in one discontinuous view, in the same order as the rows they mark. The signal walks down the diagonal." src="/img/scrna/marker_panel.png" />

A marker gene reads as the height of its 3' spike from row to row. The figure is
on a log scale, because every row shares one axis.

The `--multiwig` CLI form and the add-track UI build the same track without
hand-writing it; both are covered on [](/docs/tutorials/scatac_pseudobulk).

## One row per cell

A pseudobulk row is a sum over thousands of cells. The cells themselves can go
under it, one row each, read from a cells-by-bins Zarr matrix.

<Figure caption="The nine pseudobulk rows at LYZ above the individual cells they are a sum over, ordered by cell type and colored to match. The monocyte and dendritic blocks are solid; the lymphocyte blocks are speckle, one UMI per cell." src="/img/scrna/percell_lyz.png" />

Summed, the lymphocyte rows are a low flat line beside the monocyte peak. Per
cell, many of those cells carry a single UMI of a monocyte gene: ambient RNA in
the droplet.

Two settings decide whether the speckle is visible:

- **Order the rows by cell type.** Thousands of rows in a few hundred pixels is
  under a pixel each, so a block only reads if its cells are adjacent. The
  `group` on each row seeds that and drives the sidebar tree
- **Pin the score axis.** `minScore: 0` and a low `maxScore` put one UMI a
  visible fraction up the color ramp, as in [](/docs/tutorials/population_cnv).
  Autoscale takes its maximum from the tallest single cell in view

The store is read by the `MultiWiggleZarrAdapter` from
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr), the
adapter [](/docs/tutorials/population_cnv) uses for the 1000 Genomes panel. The
cell list, bin size and row colors are attributes of the store, written by the
build step:

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

A relative `uri` resolves against the config that holds it, and nothing runs on
the server.

The store's bin axis lays each window end to end keyed by refName, one window
per chromosome. Per-cell coverage says something only where the cells have
reads, so the store covers marker windows and stays under a megabyte.

An RNA set and an ATAC set stack in one view: the demo config carries a
pseudobulk scATAC set over the same PBMCs beside the RNA one.

## Linking the UMAP to the tracks

The
[single-cell UMAP example](https://jbrowse.org/storybook/lgv/single-cell-umap)
puts a UMAP beside this track in an embedded view. Selecting cell types calls
the display's row filter:

```ts
display.setSubtreeFilter(['CD8 T', 'NK'])
```

Filtering also tightens the shared score axis onto the rows still drawn.
Clicking a gene in the track recolors the cells by that gene's expression, read
from `session.selection`.

## Reproduce it end to end

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_scrna_pseudobulk.sh
bash build_scrna_pseudobulk.sh    # builds ./scrna_pseudobulk_build
npx --yes serve scrna_pseudobulk_build/jbrowse2
```

The script runs the standard scanpy pipeline on the filtered count matrix (QC,
normalize, PCA, neighbors, UMAP, Leiden), labels each cluster by scoring it
against canonical PBMC marker panels, printing the score matrix, then
pseudobulks the BAM against those labels and writes the JBrowse instance plus
the UMAP's data files. A cluster whose best panel score is weak is labeled
unassigned.

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

---
title: Single-cell RNA pseudobulk
description:
  Aggregate single-cell RNA into per-cell-type coverage BigWigs, with a row per
  cell underneath
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

Pooling the reads of each single-cell cluster, called pseudobulking, and placing
them on the genome shows which cell types express a marker gene, and where in
the gene their reads land. We pool the 10x 5k peripheral blood (PBMC) dataset
into one coverage BigWig per cell type outside JBrowse and load the set as one
multi-wiggle track with a row per cell type. Then we add one row per cell under
the pooled rows.

## Prerequisites

- cells already clustered and labeled, plus the barcoded BAM the counts came
  from (Cell Ranger's `possorted_genome_bam.bam`, or any BAM with a corrected
  cell-barcode tag)
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
experiment, which the build script streams and pools by cell type without
writing the BAM to disk.

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- the barcoded alignments, which the script reads by region over HTTPS:
  https://cf.10xgenomics.com/samples/cell-exp/3.0.2/5k_pbmc_v3/5k_pbmc_v3_possorted_genome_bam.bam
- the filtered feature-barcode matrix the clustering runs on:
  https://cf.10xgenomics.com/samples/cell-exp/3.0.2/5k_pbmc_v3/5k_pbmc_v3_filtered_feature_bc_matrix.h5

## Loading GRCh38

The BAM was aligned to GRCh38, and the BigWigs inherit its chromosome names, so
the tracks go on an hg38 assembly that spells them the same way.

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

## Generating per-cell-type BigWigs

Clustering and labeling happen upstream, in Seurat, scanpy, or whatever produced
the annotation. The build here starts from a barcode-to-label table and the BAM.

Two decisions determine whether the rows can be compared:

- **Duplicates.** Cell Ranger flags PCR duplicates of the same UMI (unique
  molecular identifier) with `0x400`; filter them out so a row's height tracks
  expression. Restricting to uniquely mapped reads (`MAPQ` 255, what STAR emits
  inside Cell Ranger) keeps multimappers off paralogs
- **Normalization.** Cell types differ in cell count and depth, so each pooled
  track needs scaling (CPM is usual) before one row's height means anything next
  to another's

Coverage must also be splice-aware: a read spanning an intron has an `N` in its
CIGAR, and counting that as covered fills in introns no read touched.

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
  # --samFlagExclude 1024 drops PCR duplicates; --minMappingQuality 255 keeps
  # only unique alignments; --normalizeUsing CPM scales so one cell type's
  # row compares with another's
  bamCoverage -b "$bam" -o "${bam%.bam}.bw" \
    --samFlagExclude 1024 --minMappingQuality 255 --normalizeUsing CPM
done
```

The sinto route writes a second copy of the BAM to disk, split N ways.

[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh)
instead reads the BAM by region over HTTPS, accumulating each cell type's
coverage in one pass with no download, split or scratch space. Either route
applies the normalization in its last step:

<!-- from: scripts/build_scrna_pseudobulk.sh -->

```bash
# CPM: scale by 1e6 / this cell type's own read total, so a row from 200 cells
# compares with one from 2,000
awk -v total="$reads" -v OFS='\t' \
  '{print $1, $2, $3, $4 * 1e6 / total}' celltype.bg > celltype.cpm.bg

# chromosomes in chrom.sizes order, which for UCSC names is lexicographic
# (chr1, chr10, ... chr2) and not the order reads stream in
bedGraphToBigWig celltype.cpm.bg hg38.chrom.sizes celltype.bw
```

The script fills one row per cell type in one pass over each chromosome. The
first `continue` applies the duplicate and uniqueness filters, and `get_blocks`
makes the coverage splice-aware:

<!-- from: scripts/build_scrna_pseudobulk.sh -->

```python
# of_barcode maps a corrected cell barcode to its cell type's row index
bam = pysam.AlignmentFile(BAM, "rb", index_filename=bai)
length = bam.get_reference_length(chrom)
cov = np.zeros((len(types), length // BIN + 1), dtype=np.uint32)

for read in bam.fetch(chrom):
    # 0x400 is the duplicate flag, 0x100 secondary and 0x800 supplementary. The
    # first is the duplicate decision; the other two stop one read landing in
    # several places at once. STAR emits MAPQ 255 for a unique alignment, the
    # only kind CellRanger writes.
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

The script writes each row as a bedGraph, scales it by
`1e6 / <that cell type's counted reads>`, and converts it:

<!-- from: scripts/build_scrna_pseudobulk.sh -->

```bash
bedGraphToBigWig CD8_T.all.bg hg38.chrom.sizes bw/CD8_T.bw
```

## Loading the per-cell-type BigWigs as one track

One `MultiQuantitativeTrack` holds the set, one `BigWigAdapter` subadapter per
cell type with its `name`, `color`, and `group`. The fence lists the first three
of the nine rows in the figure below; the build script writes all nine, and the
hosted config,
https://jbrowse.org/code/jb2/main/test_data/scrna_pbmc5k/config.json, has them
as `pbmc5k_scrna_pseudobulk_hg38`:

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
        "uri": "https://jbrowse.org/demos/scrna_pbmc5k/CD4_T.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CD8 T",
        "group": "T cell",
        "color": "#279e68",
        "uri": "https://jbrowse.org/demos/scrna_pbmc5k/CD8_T.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CD14 Mono",
        "group": "Monocyte",
        "color": "#8c564b",
        "uri": "https://jbrowse.org/demos/scrna_pbmc5k/CD14_Mono.bw"
      }
    ]
  },
  "displayDefaults": {
    "mark": "bar",
    "scales": { "y": { "type": "log", "title": "CPM" } },
    "height": 330
  }
}
```

Take the row order and colors from the single-cell object, so related lineages
stay adjacent and a row keeps the color its cluster had on the UMAP.

The clusters were named by scoring them against marker panels, so those markers
would light up their own rows by construction. To test the labels, open nine
markers the panels leave out, one per cell type: _CD40LG_, _LINC02446_, _SPON2_,
_CD22_, _S100A12_, _HES4_, _ENHO_, _LRRC26_ and _GNG11_. 10x 3' kits sequence
the 3' end of each transcript, so coverage is a spike near the polyadenylation
site; paste each gene's 3' end into the location box to open them side by side:

```text
chrX:136,658,390-136,662,390 chr12:10,556,794-10,560,794 chr4:1,164,931-1,168,931 chr19:35,345,361-35,349,361 chr1:153,371,710-153,375,710 chr1:996,963-1,000,963 chr9:34,519,042-34,523,042 chr9:137,166,757-137,170,757 chr7:93,926,610-93,930,610
```

<Figure caption="Nine per-cell-type BigWigs from the 10x 5k PBMC dataset, loaded as one MultiQuantitativeTrack, over nine marker loci the cluster labelling did not use, in the same order as the rows they mark. The signal runs down the diagonal." src="/img/scrna/marker_panel.png" />

Each marker's expression shows as the height of its 3' spike from row to row.
All nine rows share one axis, and its log scale keeps the weaker markers' spikes
readable beside the strongest.

`jbrowse add-track --multiwig` takes a comma-separated list of the BigWigs and
builds the same track, labeling each row from its filename, and the **Add
multi-row track** workflow under **Add track** takes the same URLs one per line.
[](/docs/tutorials/scatac_pseudobulk) shows both with per-row names, colors and
groups.

## Per-cell coverage rows from a Zarr store

A pseudobulk row sums thousands of cells. A Zarr store holding a cells-by-bins
coverage matrix adds the cells themselves, one row each, under the pooled rows.

The `MultiWiggleZarrAdapter` from
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr) reads
the store, the same adapter [](/docs/tutorials/population_cnv) uses for the 1000
Genomes panel. The build step writes the cell list, bin size and row colors as
attributes of the store. The plugin is not in the plugin store yet, so load it
from `config.json` first:

```json
{
  "plugins": [
    {
      "name": "Zarr",
      "url": "https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js"
    }
  ]
}
```

With the plugin loaded, the store is one track. The figure reads the hosted
store, https://jbrowse.org/demos/scrna_pbmc5k/percell.zarr, a directory of
chunks that 404s at its root but loads as a `uri`. For your own cells, `uri`
points at a store with the same layout, built by the reproduce script below:

```json addtrack
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
    "mark": "heatmap",
    "scales": { "y": { "domainMin": 0, "domainMax": 2 } },
    "height": 420
  }
}
```

A relative `uri` resolves against the config that holds it, so the store is
served as static files beside `config.json`.

The store holds one marker window per chromosome, looked up by chromosome name,
so the build script picks one marker per chromosome. Covering only marker
windows, where the cells have reads, keeps the store small.

Type `chr12:69,353,000-69,354,500` into the location box, the 3' end of _LYZ_,
where the 3' kit's reads land:

<Figure caption="The nine pseudobulk rows at LYZ above the individual cells they are a sum over, ordered by cell type and colored to match. The monocyte and dendritic blocks are solid; the lymphocyte blocks are speckle, one UMI per cell." src="/img/scrna/percell_lyz.png" />

Summed, the lymphocyte rows are a low flat line beside the monocyte peak. Per
cell, many lymphocytes have a single UMI of a monocyte gene, ambient RNA that
was free in the droplet.

Two settings in the config above decide whether the speckle is visible:

- **Order the rows by cell type.** Thousands of rows in a few hundred pixels is
  under a pixel each, so a block only reads if its cells are adjacent. The
  `group` on each row seeds that and drives the sidebar tree
- **Pin the score axis.** `scales.y` with a `domainMin` of 0 and a low
  `domainMax` puts one UMI a visible fraction up the color ramp, as in
  [](/docs/tutorials/population_cnv). Autoscale takes its maximum from the
  tallest single cell in view

## Reproduce it end to end

[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh)
starts from 10x's filtered count matrix and the BAM. It:

1. clusters the cells with the standard scanpy pipeline: quality filtering,
   normalization, PCA, a neighbor graph, the UMAP and Leiden clusters
2. names each cluster after the canonical PBMC marker panel it scores highest
   on, and prints the whole score matrix so each call can be checked. A cluster
   that scores weakly against every panel stays unassigned
3. pools each cell type's reads into one row, with the filters and CPM scaling
   above
4. writes the per-cell store over the marker windows, the UMAP's data files, and
   a JBrowse instance with the pooled track

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_scrna_pseudobulk.sh
bash build_scrna_pseudobulk.sh    # builds ./scrna_pseudobulk_build
npx --yes serve scrna_pseudobulk_build/jbrowse2
```

## See also

- [](/docs/tutorials/scatac_pseudobulk)
- [](/docs/tutorials/rnaseq)
- [](/docs/config_guides/quantitative_track)
- [](/docs/config/multiwiggleadapter)
- [](/docs/user_guides/clustering)

## External links

- [10x Genomics 5k PBMC v3](https://www.10xgenomics.com/datasets/5-k-peripheral-blood-mononuclear-cells-pbm-cs-from-a-healthy-donor-v-3-chemistry-3-1-standard-3-0-2),
  the dataset this page pseudobulks
- [scanpy's clustering tutorial](https://scanpy.readthedocs.io/en/stable/tutorials/basics/clustering.html),
  the pipeline the build script follows
- [sinto `filterbarcodes`](https://timoast.github.io/sinto/basic_usage.html) and
  [deepTools `bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
  for the split-the-BAM route

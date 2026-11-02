---
title: Single-cell RNA and ATAC pseudobulk
description:
  Aggregate single-cell RNA and ATAC into per-cell-type coverage BigWigs, with a
  row per cell underneath
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

Pooling the reads of each single-cell cluster, called pseudobulking, and placing
them on the genome shows which cell types express a marker gene, and where in
the gene their reads land. Single-cell ATAC fragments pooled the same way give
one chromatin accessibility profile per cell type. With two separate 10x
releases of peripheral blood cells (PBMC), one RNA and one ATAC, we:

- pool RNA reads or ATAC fragments into one coverage BigWig per cell type,
  outside JBrowse
- load each set as one multi-wiggle track with a row per cell type
- open nine RNA marker genes side by side
- add one row per cell under the pooled RNA rows, from a Zarr store
- read the ATAC rows at a T-cell and a B-cell marker

## Prerequisites

- for RNA, cells already clustered and labeled, plus the barcoded BAM the counts
  came from (Cell Ranger's `possorted_genome_bam.bam`, or any BAM with a
  corrected cell-barcode tag)
- for ATAC, cells already clustered and labeled, as a fragments file or a
  barcoded BAM plus a barcode-to-label table, or as the project object your
  analysis tool already holds, an `AnnData` in SnapATAC2 (Python), an
  `ArchRProject` in ArchR, or a Seurat/Signac object in R
- the pooling tool that matches what you have:
  [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) from the UCSC
  utilities, `pip install deeptools sinto` plus `samtools` for the split-the-BAM
  route, or `pip install snapatac2` (ArchR and Signac install from R). The
  [RNA reproduce script](#reproduce-it-end-to-end) bins the reads itself, so it
  needs `bedGraphToBigWig` but neither deepTools nor sinto
- a JBrowse instance to load the finished BigWigs into (see the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))
- the zarr plugin, for
  [the Zarr store](#per-cell-coverage-rows-from-a-zarr-store). In your own
  JBrowse, load it by the URL that section gives

## The data

10x Genomics'
[5k PBMC v3](https://www.10xgenomics.com/datasets/5-k-peripheral-blood-mononuclear-cells-pbm-cs-from-a-healthy-donor-v-3-chemistry-3-1-standard-3-0-2)
RNA experiment, which the RNA build script streams and pools by cell type
without writing the BAM to disk, and SnapATAC2's annotated release of 10x's 5k
PBMC scATAC experiment, already clustered and cell-type-labeled.

You don't need these files to follow the page: every track reads a hosted copy
of what the commands below write, and the per-cell track's config points at the
Zarr store the RNA build script makes, with the hosted copy's URL beside it. The
[build scripts](#reproduce-it-end-to-end) fetch everything themselves; the ATAC
one downloads the dataset through SnapATAC2 (about 800 MB, ten minutes). To
generate per-cell-type BigWigs, supply your own barcoded BAM or fragments file
and barcode table.

| What it is                                                                                           | File                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| The barcoded RNA alignments, streamed and never downloaded                                           | [5k_pbmc_v3_possorted_genome_bam.bam](https://cf.10xgenomics.com/samples/cell-exp/3.0.2/5k_pbmc_v3/5k_pbmc_v3_possorted_genome_bam.bam)           |
| The filtered feature-barcode matrix the RNA clustering runs on                                       | [5k_pbmc_v3_filtered_feature_bc_matrix.h5](https://cf.10xgenomics.com/samples/cell-exp/3.0.2/5k_pbmc_v3/5k_pbmc_v3_filtered_feature_bc_matrix.h5) |
| The annotated ATAC `AnnData` that `snap.datasets.pbmc5k(type="annotated_h5ad")` downloads and caches | [snapatac2.datasets.pbmc5k.html](https://scverse.org/SnapATAC2/api/_autosummary/snapatac2.datasets.pbmc5k.html)                                   |

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                 | File                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| CATlas' published hg38 per-cell-type accessibility BigWigs | [bw/](https://decoder-genetics.wustl.edu/catlasv1/humanenhancer/data/bw/) |

</details>

## Loading GRCh38

The RNA reads and the ATAC fragments were both aligned to GRCh38, and the
BigWigs inherit its `chr1`-style chromosome names, so the tracks go on an hg38
assembly that spells them the same way. A BigWig whose names differ from the
assembly's, such as Ensembl's `1` against `chr1`, draws empty unless the
assembly has a name-alias table.

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

The figures also show NCBI's RefSeq genes as a track:

```json addtrack
{
  "trackId": "ncbi_refseq_hg38",
  "name": "NCBI RefSeq genes",
  "type": "FeatureTrack",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz",
    "csi": true
  }
}
```

## Generating per-cell-type BigWigs

Clustering and labeling happen upstream, in Seurat, scanpy, Cell Ranger ATAC,
ArchR, Signac or SnapATAC2. Each route below starts from a barcode-to-label
table or a labeled object and ends at one `.bw` per cell type, which JBrowse
stacks as rows of one track.[^inline]

### From a barcoded RNA BAM

Three decisions determine whether the rows can be compared:

- **Duplicates and multimappers.** Cell Ranger flags PCR duplicates of the same
  UMI (unique molecular identifier) with `0x400`; filter them out so a row's
  height tracks expression. Restricting to uniquely mapped reads (`MAPQ` 255,
  what STAR emits inside Cell Ranger) keeps multimappers off paralogs
- **Normalization.** Cell types differ in cell count and depth, so each pooled
  track needs scaling (CPM is usual) before one row's height means anything next
  to another's
- **Splice-aware coverage.** A read spanning an intron has an `N` in its CIGAR,
  and counting that as covered fills in introns no read touched

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

The sinto route writes a second copy of the BAM to disk, split N ways;
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

The script fills one row per cell type in one pass over each chromosome:

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

The last step converts each row's bedGraph:

<!-- from: scripts/build_scrna_pseudobulk.sh -->

```bash
bedGraphToBigWig CD8_T.all.bg hg38.chrom.sizes bw/CD8_T.bw
```

### From ATAC fragments

One ATAC cell contributes a few thousand fragments, so a single cell's coverage
is almost entirely zero, and pooling a cluster's cells gives a profile with
peaks. Normalization matters as it does for RNA, since groups differ in cell
count and total fragments. The bin size trades resolution against file size and
has to stay well inside one peak.

SnapATAC2's `export_coverage` splits cells by a metadata column and writes one
normalized BigWig per group in a single call:

<!-- from: scripts/build_scatac_pseudobulk.sh -->

```python
import snapatac2 as snap

# adata: an AnnData with fragments imported and a cell-type/cluster label in obs
snap.ex.export_coverage(
    adata,
    groupby="cell_type",     # column in adata.obs to split on
    bin_size=25,             # bp per bin
    normalization="RPKM",    # comparable across groups
    out_dir="bw",
    suffix=".bw",
    n_jobs=2,                # each worker holds a genome-wide coverage vector
    # blacklist= takes an ENCODE blacklist BED and drops those intervals from
    # every group. The build script does not pass it, so the figures below are
    # unmasked coverage.
)
# writes bw/<cell_type>.bw, one per group, keyed by group in the returned dict
```

Too many `n_jobs` workers exhaust memory and fail the writer partway through the
groups. `groupby="leiden"` gives one BigWig per cluster instead.

The other ATAC tools reach the same files:

- **An `ArchRProject`**: `getGroupBW(groupBy = "CellType", tileSize = 25)`
  writes one BigWig per group. `normMethod = "ReadsInTSS"` normalizes by
  signal-in-TSS; `"nCells"` and `"nFrags"` are the alternatives
- **A barcoded ATAC BAM** (Cell Ranger ATAC, or a Signac workflow's input):
  split it with `sinto filterbarcodes` as for RNA, then run `bamCoverage` on
  each with `--binSize 25 --normalizeUsing CPM --extendReads`. `RPGC` also needs
  `--effectiveGenomeSize`
- **A `fragments.tsv.gz` alone**: filter it to each cluster's barcodes, then
  `bedtools genomecov -bg` and `bedGraphToBigWig` per group. This route is
  unnormalized, so scale each group yourself (1e6 / total fragments for CPM)
  before the conversion

## Loading the per-cell-type BigWigs as one track

One `MultiQuantitativeTrack` holds the set, one `BigWigAdapter` subadapter per
cell type with its `name`, `color`, and `group`. The fence lists the first RNA
rows in the figure below; the build script writes all of them, and the hosted
config, https://jbrowse.org/code/jb2/main/test_data/scrna_pbmc5k/config.json,
has them as `pbmc5k_scrna_pseudobulk_hg38`. Swap each `uri` for a BigWig your
pooling step wrote:

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
    "encoding": {
      "y": { "scale": { "type": "log" }, "axis": { "title": "CPM" } }
    },
    "height": 330
  }
}
```

In [grammar-of-graphics](/docs/config_guides/mark_display) terms, a
[`mark`](/docs/config/linearwiggledisplay/#slot-mark) is the shape drawn and
`encoding.y` is the y scale. `bar` compares peak shape, and `rect`, which the
track menu switches to, maps score to color and fits more rows. The rows share
one axis, and its `log` type keeps a dim row readable beside a bright one such
as _LYZ_ in monocytes.

Set three things in the `subadapters` list from the single-cell object:

- the order: subadapters draw in the order given, so group them by lineage
- `color`: copy the cluster color from your analysis, so a cell type matches its
  UMAP color
- `group`: the sidebar tree branches on it, and [](/docs/user_guides/clustering)
  clusters rows within each group

### Building the track from a list of BigWigs

Without per-row names, colors or groups, the `bigWigs` shorthand takes a plain
array of URLs and labels each row from its filename:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "scrna_pseudobulk_simple",
  "name": "scRNA pseudobulk",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "bigWigs": [
      "https://jbrowse.org/demos/scrna_pbmc5k/CD4_T.bw",
      "https://jbrowse.org/demos/scrna_pbmc5k/CD8_T.bw",
      "https://jbrowse.org/demos/scrna_pbmc5k/CD14_Mono.bw"
    ]
  }
}
```

Two workflows write the list from a set of files:

- **Add multi-row track**, in the **Add track** workflow, takes BigWig URLs one
  per line, or a JSON array of subadapter objects. On JBrowse Desktop it reads
  local `.bw` files directly, and the same form stacks BED or BigBed files, one
  row of features per file. Exporting the session gets the JSON config back out
- **`jbrowse add-track --multiwig`** takes the whole set of BigWigs in place of
  the single positional file, labeling rows from the filenames, as in the
  command below

```bash
jbrowse add-track --multiwig "$(find bw -name '*.bw' | sort | paste -sd,)" \
  --name "Pseudobulk by cell type" --assemblyNames hg38 \
  --load copy --subDir bw --out /var/www/html/jbrowse2
```

`--load copy --subDir bw` copies local files in beside `config.json`; leave both
off for BigWigs already served over HTTP. For per-row names, colors and groups,
pass a `.json` file of subadapter objects instead of the comma list.

## RNA marker genes side by side

We named the RNA clusters by scoring them against marker panels, so those
markers have signal in the rows of their cell types by construction. To test the
labels, we open nine markers the panels leave out, one per cell type: _CD40LG_,
_LINC02446_, _SPON2_, _CD22_, _S100A12_, _HES4_, _ENHO_, _LRRC26_ and _GNG11_.
10x 3' kits sequence the 3' end of each transcript, so coverage is a spike near
the polyadenylation site. Paste each gene's 3' end into the location box to open
them side by side:

```text
chrX:136,658,390-136,662,390 chr12:10,556,794-10,560,794 chr4:1,164,931-1,168,931 chr19:35,345,361-35,349,361 chr1:153,371,710-153,375,710 chr1:996,963-1,000,963 chr9:34,519,042-34,523,042 chr9:137,166,757-137,170,757 chr7:93,926,610-93,930,610
```

<Figure caption="The per-cell-type BigWigs as one MultiQuantitativeTrack over the nine marker loci, in the order of the rows they mark." src="/img/scrna/marker_panel.png" />

## Per-cell coverage rows from a Zarr store

A pseudobulk RNA row sums thousands of cells. A Zarr store holding a
cells-by-bins coverage matrix adds the cells themselves, one row each, under the
pooled rows.

The `MultiWiggleZarrAdapter` from
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr) reads
the store, the same adapter [](/docs/tutorials/population_cnv) uses for the 1000
Genomes panel. The build step writes the cell list, bin size and row colors as
attributes of the store. The plugin is not in the plugin store yet. On Desktop,
add the URL below as a
[custom plugin](/docs/user_guides/plugin_store#a-plugin-not-in-the-store) named
`Zarr`; elsewhere, add this `plugins` entry to `config.json`:

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
  "trackId": "pbmc5k_scrna_percell_hg38",
  "name": "Per-cell coverage (marker loci)",
  "category": ["Single cell"],
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleZarrAdapter",
    "uri": "percell.zarr"
  },
  "displayDefaults": {
    "mark": "rect",
    "encoding": { "y": { "scale": { "domainMin": 0, "domainMax": 2 } } },
    "height": 420
  }
}
```

A relative `uri` resolves against the config that holds it, so the store is
served as static files beside `config.json`.

The store covers the marker windows, where the cells have reads, which keeps it
small. The lookup is by chromosome name, so the build script picks one marker
per chromosome.

Type `chr12:69,353,000-69,354,500` into the location box, the 3' end of _LYZ_,
where the 3' kit's reads land:

<Figure caption="The pseudobulk rows at LYZ above the cells they sum, ordered by cell type and colored to match." src="/img/scrna/percell_lyz.png" />

Per cell, many lymphocytes have a single UMI of a monocyte gene, ambient RNA
that was free in the droplet.

Two settings decide whether the speckle is visible:

- **Order the rows by cell type.** Thousands of rows in a few hundred pixels is
  under a pixel each, so a block only reads if its cells are adjacent. The
  `group` each cell has in the store's attributes seeds that and drives the
  sidebar tree
- **Pin the score axis.** A low `domainMax` puts one UMI a visible fraction up
  the color ramp, whereas autoscale takes its maximum from the tallest single
  cell in view

## ATAC accessibility at a T-cell and a B-cell marker

The ATAC BigWigs written under _From ATAC fragments_ load the same way, as a
second track. The fence lists some of the cell types the figure draws; the
[ATAC build script](#reproduce-it-end-to-end) writes the whole list, and the
hosted demo config,
https://jbrowse.org/code/jb2/main/test_data/config_demo.json, has it as
`pbmc5k_scatac_pseudobulk_hg38`:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "scatac_pseudobulk",
  "name": "scATAC by cell type",
  "category": ["Single cell", "Chromatin accessibility"],
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "CD8 Naive",
        "group": "T cell",
        "color": "#4363d8",
        "uri": "https://jbrowse.org/demos/scatac_pbmc5k/CD8_Naive.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CD8 Memory",
        "group": "T cell",
        "color": "#3cb44b",
        "uri": "https://jbrowse.org/demos/scatac_pbmc5k/CD8_Memory.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "Naive B",
        "group": "B cell",
        "color": "#f58231",
        "uri": "https://jbrowse.org/demos/scatac_pbmc5k/Naive_B.bw"
      }
    ]
  }
}
```

At a T-cell marker the T-cell rows have signal and the B-cell rows stay flat,
and at a B-cell marker the reverse. Paste a T-cell marker (_CD8A_) and a B-cell
marker (_MS4A1_) into the location box to open them side by side:

```text
chr2:86,780,000-86,820,000 chr11:60,450,000-60,490,000
```

<Figure caption="The per-cell-type ATAC BigWigs as one MultiQuantitativeTrack over CD8A and MS4A1 side by side." src="/img/scatac/pbmc5k_marker_swap.png" />

[CATlas](https://www.catlas.org/) serves hg38 per-cell-type accessibility, one
file per cell type, from
`https://decoder-genetics.wustl.edu/catlasv1/humanenhancer/data/bw/`; its URLs
go into the `subadapters` list like the PBMC files. Percent-encode the `+` in a
cell-type name (`T_lymphocyte_2_CD4%2B.bw`); left unencoded, the URL breaks and
the row loads with no data.

## Reproduce it end to end

[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh)
starts from 10x's filtered RNA count matrix and the BAM. It:

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

[`build_scatac_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scatac_pseudobulk.sh)
starts from SnapATAC2's annotated release of the 10x 5k PBMC ATAC dataset, whose
[standard pipeline](https://scverse.org/SnapATAC2/tutorials/pbmc.html) and
[cell-type annotation](https://scverse.org/SnapATAC2/tutorials/annotation.html)
tutorials leave every cell filtered, clustered and labeled, with its fragments
beside its `cell_type`. The script:

1. pools each cell type's fragments into one BigWig, in 25 bp bins and RPKM, as
   above
2. orders the rows by lineage (T cells, NK, B cells, then myeloid) from a map
   written into the script, because the object's own label order scatters each
   lineage down the stack. To run it on your own experiment, replace that map
3. gives each row its cluster's color from the same object, so a cell type
   matches its UMAP
4. loads the set as one track over hg38 and RefSeq genes

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_scatac_pseudobulk.sh
bash build_scatac_pseudobulk.sh    # builds ./scatac_pseudobulk_build
npx --yes serve scatac_pseudobulk_build/jbrowse2
```

Rows that stay open everywhere usually mean the normalization step was skipped,
since an unnormalized group's height tracks its cell count.

## See also

- [](/docs/tutorials/rnaseq)
- [](/docs/tutorials/chromhmm)
- [](/docs/config_guides/quantitative_track)
- [](/docs/config/multiwiggleadapter)
- [](/docs/models/linearwiggledisplay)
- [](/docs/user_guides/clustering)

## External links

- [10x Genomics 5k PBMC v3](https://www.10xgenomics.com/datasets/5-k-peripheral-blood-mononuclear-cells-pbm-cs-from-a-healthy-donor-v-3-chemistry-3-1-standard-3-0-2),
  the RNA dataset this page pseudobulks
- [SnapATAC2's 5k PBMC scATAC dataset](https://scverse.org/SnapATAC2/api/_autosummary/snapatac2.datasets.pbmc5k.html),
  the 10x Genomics ATAC experiment this page pseudobulks, in its clustered and
  cell-type-annotated form
- [scanpy's clustering tutorial](https://scanpy.readthedocs.io/en/stable/tutorials/basics/clustering.html),
  the pipeline the RNA build script follows
- [SnapATAC2 `export_coverage`](https://scverse.org/SnapATAC2/version/dev/api/_autosummary/snapatac2.ex.export_coverage.html)
- [ArchR: exporting pseudobulk BigWigs (`getGroupBW`)](https://www.archrproject.com/bookdown/exporting-pseudo-bulked-data-to-a-bigwig-file.html)
- [sinto `filterbarcodes`](https://timoast.github.io/sinto/basic_usage.html) and
  [deepTools `bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
  for the split-the-BAM route, and deepTools'
  [normalization methods](https://github.com/deeptools/deepTools/wiki/Normalizations)

## Citations

- Zhang et al. (2021).
  [A single-cell atlas of chromatin accessibility in the human genome](https://www.sciencedirect.com/science/article/pii/S0092867421012794),
  and its [resource portal](https://www.catlas.org/), the published atlas a
  track reads without building anything

[^inline]:
    The BigWigs can also be viewed inline from the clustering environment
    through the [Python anywidget interface](/docs/jbrowse_anywidget) or
    [](/docs/jbrowser).

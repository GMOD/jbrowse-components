---
title: Single-cell ATAC pseudobulk
description: Aggregate single-cell ATAC into per-cell-type coverage BigWigs
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

Single-cell ATAC-seq measures chromatin accessibility one cell at a time, and
pooling the cells of each cluster, called pseudobulking, gives one accessibility
profile per cell type. We pool a clustered 10x peripheral blood (PBMC) dataset
into one coverage BigWig per cell type outside JBrowse, load the set as one
multi-wiggle track with a row per file, and check the rows at T-cell and B-cell
marker genes.

## Prerequisites

- cells already clustered and labeled: either a fragments file (or a barcoded
  BAM) plus a barcode-to-label table, or the project object your analysis tool
  already holds, an `AnnData` in SnapATAC2 (Python), an `ArchRProject` in ArchR,
  or a Seurat/Signac object in R
- the pseudobulk tool that follows from whichever of those you have:
  `pip install snapatac2`, `pip install deeptools sinto`, or
  [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) for the
  fragments-file route (ArchR and Signac install from R)
- a JBrowse instance to load the finished BigWigs into (see the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

SnapATAC2's annotated release of the 10x 5k PBMC scATAC dataset, already
clustered and cell-type-labeled by the SnapATAC2 pipeline.

The [build script](#reproduce-it-end-to-end) downloads the dataset through
SnapATAC2, so there is nothing to download by hand.

- the annotated `AnnData` that `snap.datasets.pbmc5k(type="annotated_h5ad")`
  downloads and caches:
  https://scverse.org/SnapATAC2/api/_autosummary/snapatac2.datasets.pbmc5k.html

<details>
<summary>Read by URL (no download needed)</summary>

- CATlas' published hg38 per-cell-type accessibility BigWigs from:
  https://decoder-genetics.wustl.edu/catlasv1/humanenhancer/data/bw/

</details>

## Pooling cells into one coverage track per cell type

One ATAC cell contributes only a few thousand fragments, so its own coverage is
almost entirely zero. JBrowse stacks the pooled files as rows of one
track.[^inline]

PBMC marker genes are the control. At a T-cell marker the T-cell rows have
signal and the B-cell rows stay flat, and at a B-cell marker the reverse.

## Generating one pseudobulk BigWig per cell type

Clustering and cell-type labeling happen upstream, in Cell Ranger ATAC, ArchR,
Signac, or SnapATAC2. Whichever tool writes the files, two settings decide
whether the rows compare:

- **Normalization.** Groups differ in cell count and total fragments, so each
  track needs normalizing (CPM / RPKM, or per-cell-count) for a peak's height to
  mean accessibility
- **Bin size**, which trades resolution against file size. The bin has to stay
  well inside one peak; `export_coverage` below uses 25 bp

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

### Pseudobulk BigWigs from ArchR, a barcoded BAM or a fragments file

Every route ends at one `.bw` per cell type:

- **An `ArchRProject`**: `getGroupBW(groupBy = "CellType", tileSize = 25)`
  writes one BigWig per group. `normMethod = "ReadsInTSS"` normalizes by
  signal-in-TSS; `"nCells"` and `"nFrags"` are the alternatives
- **A barcoded BAM** (Cell Ranger ATAC, or a Signac workflow's input): split it
  by label with `sinto filterbarcodes`, then run deepTools `bamCoverage` on each
  with `--binSize 25 --normalizeUsing CPM --extendReads`. `RPGC` also needs
  `--effectiveGenomeSize`
- **A `fragments.tsv.gz` alone**: filter it to each cluster's barcodes, then
  `bedtools genomecov -bg` and `bedGraphToBigWig` per group. This route is
  unnormalized, so scale each group yourself (1e6 / total fragments for CPM)
  before the conversion

## Loading GRCh38 with chr-style names

The fragments are aligned to GRCh38, so the BigWigs use its `chr1`-style
chromosome names, and the assembly has to spell them the same way. A BigWig
whose names differ from the assembly's, such as Ensembl's `1` against `chr1`,
draws empty unless the assembly has a name-alias table.

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

## Loading the BigWigs as a MultiWiggle track

All the per-cell-type BigWigs go into one `MultiQuantitativeTrack` whose
`MultiWiggleAdapter` holds one `BigWigAdapter` per file, each with a `name`, an
optional `color`, and an optional `group`. Swap each `uri` for the BigWig your
pooling step wrote.

The fence lists three of the twelve cell types the figure draws; the
[build script](#reproduce-it-end-to-end) writes the whole list, and the hosted
demo config, https://jbrowse.org/code/jb2/main/test_data/config_demo.json, has
it as `pbmc5k_scatac_pseudobulk_hg38`:

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

The `subadapters` list has three things only you can set:

- the order: subadapters draw in the order given, so group them by lineage
- `color`: copy the cluster color from your analysis, so a cell type matches its
  UMAP color
- `group`: the sidebar tree branches on it, and [](/docs/user_guides/clustering)
  clusters rows within each group

Without per-row names, colors or groups, the `bigWigs` shorthand takes a plain
array of URLs and labels each row from its filename:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "scatac_pseudobulk_simple",
  "name": "scATAC pseudobulk",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "bigWigs": [
      "https://jbrowse.org/demos/scatac_pbmc5k/CD8_Naive.bw",
      "https://jbrowse.org/demos/scatac_pbmc5k/CD8_Memory.bw",
      "https://jbrowse.org/demos/scatac_pbmc5k/Naive_B.bw"
    ]
  }
}
```

[CATlas](https://www.catlas.org/) serves hg38 per-cell-type coverage, one file
per cell type, from
`https://decoder-genetics.wustl.edu/catlasv1/humanenhancer/data/bw/`; its URLs
go into the `subadapters` list like the PBMC files. Percent-encode the `+` in a
cell-type name (`T_lymphocyte_2_CD4%2B.bw`); left unencoded, the URL breaks and
the row loads with no data.

The track menu switches [`mark`](/docs/config/linearwiggledisplay/#slot-mark)
between drawing modes. `bar` (the default, and the figures here) compares peak
shape; `span` maps score to color and fits more rows.
[](/docs/user_guides/quantitative_track) covers the rest of the menu.

To check the rows against marker genes, paste two loci into the location box to
open them side by side in one view, a T-cell marker (_CD8A_) and a B-cell marker
(_MS4A1_):

```text
chr2:86,780,000-86,820,000 chr11:60,450,000-60,490,000
```

<Figure caption="Twelve per-cell-type BigWigs from the 10x 5k PBMC scATAC dataset, loaded as one MultiQuantitativeTrack, over CD8A and MS4A1 side by side in one view. The CD8, MAIT and NK rows have signal at CD8A, and only the two B rows have it at MS4A1." src="/img/scatac/pbmc5k_marker_swap.png" />

### Building the track from a folder of BigWigs

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
  --name "scATAC by cell type" --assemblyNames hg38 \
  --load copy --subDir bw --out /var/www/html/jbrowse2
```

`--load copy --subDir bw` copies local files in beside `config.json`; leave both
off for BigWigs already served over HTTP. For per-row names, colors and groups,
pass a `.json` file of subadapter objects instead of the comma list.

## Reproduce it end to end

[`build_scatac_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scatac_pseudobulk.sh)
starts from SnapATAC2's annotated release of the 10x 5k PBMC dataset, whose
[standard pipeline](https://scverse.org/SnapATAC2/tutorials/pbmc.html) and
[cell-type annotation](https://scverse.org/SnapATAC2/tutorials/annotation.html)
tutorials leave every cell filtered, clustered and labeled, with its fragments
beside its `cell_type`. The script:

1. pools each cell type's fragments into one BigWig, in 25 bp bins and RPKM, as
   above
2. orders the rows by lineage (T cells, NK, B cells, then myeloid) from a map
   written into the script, because the object's own label order scatters each
   lineage down the stack. Running it on your own experiment means replacing
   that map
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

- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/config_guides/quantitative_track)
- [](/docs/config/multiwiggleadapter)
- [](/docs/models/linearwiggledisplay)
- [](/docs/user_guides/clustering)
- [](/docs/tutorials/chromhmm)

## External links

- [SnapATAC2 `export_coverage`](https://scverse.org/SnapATAC2/version/dev/api/_autosummary/snapatac2.ex.export_coverage.html)
- [ArchR: exporting pseudobulk BigWigs (`getGroupBW`)](https://www.archrproject.com/bookdown/exporting-pseudo-bulked-data-to-a-bigwig-file.html)
- [deepTools `bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
  and its
  [normalization methods](https://github.com/deeptools/deepTools/wiki/Normalizations)
- [sinto `filterbarcodes` (split BAM by barcode/label)](https://timoast.github.io/sinto/basic_usage.html)
- [SnapATAC2's 5k PBMC scATAC dataset](https://scverse.org/SnapATAC2/api/_autosummary/snapatac2.datasets.pbmc5k.html),
  the 10x Genomics experiment this page pseudobulks, in its clustered and
  cell-type-annotated form

## Citations

- [CATlas: a single-cell atlas of chromatin accessibility in the human genome (Zhang et al., Cell 2021)](https://www.sciencedirect.com/science/article/pii/S0092867421012794)
  · [resource portal](https://www.catlas.org/), the published atlas a track
  reads without building anything

[^inline]:
    The BigWigs can also be viewed inline from the clustering environment
    through the [Python anywidget interface](/docs/jbrowse_anywidget) or
    [](/docs/jbrowser).

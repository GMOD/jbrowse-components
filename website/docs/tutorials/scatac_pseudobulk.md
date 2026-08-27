---
title: Single-cell ATAC pseudobulk
description: Aggregate single-cell ATAC into per-cell-type coverage BigWigs
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
data: pipeline
---

**TL;DR:** pseudobulk outside JBrowse, pooling each cluster's cells into one
coverage BigWig, then load the whole set as a single MultiWiggle track, which
draws one row per file.

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
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop), which opens local `.bw` files
  with nothing hosted)

## Where the data comes from

SnapATAC2's annotated release of the 10x 5k PBMC scATAC dataset, already
clustered and cell-type-labeled by that tool's own pipeline.

- the annotated `AnnData` that `snap.datasets.pbmc5k(type="annotated_h5ad")`
  downloads and caches:
  https://scverse.org/SnapATAC2/api/_autosummary/snapatac2.datasets.pbmc5k.html
- CATlas' published hg38 per-cell-type accessibility BigWigs from:
  https://decoder-genetics.wustl.edu/catlasv1/humanenhancer/data/bw/

## Pooling cells into rows

One ATAC cell contributes only a few thousand fragments, so a coverage track of
a single cell is almost entirely zero. Pseudobulking pools every fragment
belonging to a label into one profile, and each cell type comes out as a dense
track resembling a bulk ATAC experiment on that cell type alone. JBrowse stacks
the resulting files as rows of one track.

PBMC markers are the check: at a T-cell marker the T-cell rows carry the signal,
and at a B-cell marker the B-cell rows light up.

The pseudobulk step runs in the same environment your clustering does, so the
BigWigs it writes can also be viewed inline through the
[Python anywidget interface](/docs/jbrowse_anywidget) (or [](/docs/jbrowser))
without leaving the session.

## Generating per-group BigWigs

Clustering and cell-type labeling stay upstream, in Cell Ranger ATAC, ArchR,
Signac, or SnapATAC2. Two settings decide whether the rows this page draws can
be compared to each other, whichever tool writes them:

- **Normalization.** Groups differ in cell count and in total fragments, so each
  track needs normalizing (CPM / RPKM, or per-cell-count) for a peak's height to
  mean accessibility.
- **Bin size**, which trades resolution against file size. Peak shape is the
  readable part of an ATAC track, so the bin has to stay well inside one peak;
  `export_coverage` below uses 25 bp.

SnapATAC2's `export_coverage` splits cells by a metadata column and writes one
normalized BigWig per group in a single call, which covers the pseudobulk step
for this dataset:

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

`n_jobs` is a memory knob: each worker holds a whole genome-wide coverage
vector, and the BigWig writer dies partway through the groups when memory runs
out. Two workers fit this dataset.

`groupby` is the whole decision: pass the cluster column (`"leiden"`) to get one
row per cluster, or the annotated column (`"cell_type"`) to get one row per cell
type.

### Other starting points

Every route ends at one `.bw` per cell type. The tools are linked under
[References](#references):

- **An `ArchRProject`**: `getGroupBW(groupBy = "CellType", tileSize = 25)`
  groups cells, sums their Tn5 insertions and writes one BigWig per group.
  `normMethod = "ReadsInTSS"` normalizes by signal-in-TSS, accounting for depth
  and data quality together; `"nCells"` and `"nFrags"` are the alternatives.
- **A barcoded BAM** (Cell Ranger ATAC, or what a Signac workflow starts from):
  split it by label with `sinto filterbarcodes`, passing the barcode-to-label
  table and the barcode tag, then run deepTools `bamCoverage` on each with
  `--binSize 25 --normalizeUsing CPM --extendReads`. `RPGC` also needs
  `--effectiveGenomeSize`; CPM and RPKM do not.
- **A `fragments.tsv.gz` and nothing else**: filter it to each cluster's
  barcodes, then `bedtools genomecov -bg` and `bedGraphToBigWig` per group. This
  route is unnormalized, so scale each group yourself (1e6 / total fragments for
  CPM) before the conversion.

## Loading the BigWigs as a MultiWiggle track

In JBrowse, all the per-cell-type BigWigs go into one track: a
`MultiQuantitativeTrack` whose `MultiWiggleAdapter` holds one `BigWigAdapter`
per file. Each subadapter carries a `name` (the row label), an optional `color`,
and an optional `group`.

### Via the UI

From the "Add track" workflow, switch to "Add multi-wiggle track" and paste your
BigWig URLs one per line (or a JSON array of subadapter objects). JBrowse builds
the `MultiQuantitativeTrack` for you, and exporting the session gets the JSON
config back out. On JBrowse Desktop the same workflow loads the `.bw` files
straight from local disk with no web server.

### Via the CLI

`jbrowse add-track --multiwig` takes the whole set of BigWigs in place of the
usual single positional file, and builds the `MultiQuantitativeTrack` from them.
The row labels come from the filenames, which the pseudobulk step already named
after the groups:

```bash
jbrowse add-track --multiwig "$(find bw -name '*.bw' | sort | paste -sd,)" \
  --name "scATAC by cell type" --assemblyNames hg38 \
  --load copy --subDir bw --out /var/www/html/jbrowse2
```

`--load copy --subDir bw` copies local files in beside `config.json`; drop both
for BigWigs already served over HTTP. To carry per-row names, colors, and
groups, pass a `.json` file of subadapter objects (the same objects as the
config below) instead of the comma list.

### Via config JSON

Add a track object to your config's `tracks` array. Its `assemblyNames` must
match an assembly already configured in JBrowse (the BigWigs above were built
against `hg38`). If you don't have it set up yet, see the
[assemblies configuration guide](/docs/config_guides/assemblies). Minimal
three-cell-type example against hg38:

```json
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
        "uri": "https://example.com/bw/CD8_Naive.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CD8 Memory",
        "group": "T cell",
        "color": "#3cb44b",
        "uri": "https://example.com/bw/CD8_Memory.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "Naive B",
        "group": "B cell",
        "color": "#f58231",
        "uri": "https://example.com/bw/Naive_B.bw"
      }
    ]
  }
}
```

Three things in that list are worth writing by hand:

- **Order.** Subadapters draw in the order given, so list them grouped by
  lineage.
- **`color`.** Take each row's from the cluster's color in your analysis, so a
  cell type is the same color in the browser as on the UMAP.
- **`group`.** What the sidebar tree branches on, and what
  [](/docs/user_guides/clustering) reorders.

If you don't need per-row names, colors or groups, the `bigWigs` shorthand takes
a plain array of URLs and derives each row's label from its filename:

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "scatac_pseudobulk_simple",
  "name": "scATAC pseudobulk",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "bigWigs": [
      "https://example.com/bw/CD8_Naive.bw",
      "https://example.com/bw/CD8_Memory.bw",
      "https://example.com/bw/Naive_B.bw"
    ]
  }
}
```

A `uri` reaches anywhere, so a published atlas needs no pipeline at all:
[CATlas](https://www.catlas.org/) serves hg38 coverage from
`https://decoder-genetics.wustl.edu/catlasv1/humanenhancer/data/bw/`, one file
per cell type, and naming the ones you want is the whole track. Percent-encode
the `+` in a cell-type name — `T_lymphocyte_2_CD4%2B.bw` — which is the one way
those URLs go wrong quietly.

The display is a `MultiLinearWiggleDisplay`, and how the rows are drawn is one
slot:
[`defaultRendering`](/docs/config/multilinearwiggledisplay/#slot-defaultrendering)
lists every mode, and the track menu switches between them live. `multirowxy`
(the default, and the figures on this page) is best for comparing peak shape;
`multirowdensity` maps score to color, which fits more rows in the same space.
[](/docs/user_guides/multiquantitative_track) covers the rest of the menu.

Loaded, the twelve rows put the marker check in one frame:

<Figure caption="Twelve per-cell-type BigWigs from the 10x 5k PBMC scATAC dataset, loaded as one MultiQuantitativeTrack, over CD8A and MS4A1 in one discontinuous view. CD8A is carried by the CD8, MAIT and NK rows; MS4A1 by the two B rows and nothing else." src="/img/scatac/pbmc5k_marker_swap.png" />

## Reproduce it end to end

One script runs the whole path,
[`build_scatac_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scatac_pseudobulk.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_scatac_pseudobulk.sh
bash build_scatac_pseudobulk.sh    # builds ./scatac_pseudobulk_build
npx --yes serve scatac_pseudobulk_build/jbrowse2
```

Its input is SnapATAC2's annotated release of the 10x 5k-PBMC dataset, which is
what that tool's
[standard pipeline](https://scverse.org/SnapATAC2/tutorials/pbmc.html) and
[cell-type annotation](https://scverse.org/SnapATAC2/tutorials/annotation.html)
tutorials already produce: fragments imported, cells QC-filtered and clustered,
and each cluster labeled by transferring cell types from a matched multiome
reference. That `AnnData` carries per-barcode fragments alongside an
`obs["cell_type"]` call, which is the pair pseudobulking needs, so the script's
own work is short:

- `export_coverage(groupby="cell_type", bin_size=25, normalization="RPKM")`,
  which writes one BigWig per cell type into `bw/`
- a `sources.json` of subadapters, taking each row's color from the same object
  and its `group` and position from a lineage map the script states outright.
  Running it on your own experiment means replacing that map
- `jbrowse create` plus `add-assembly` for hg38 and a RefSeq gene track, then
  the one `MultiQuantitativeTrack` those subadapters make up

Navigate the finished instance to the two markers in the figure and read the
rows against the labels. Rows that stay open everywhere usually mean the
normalization step was skipped, since an unnormalized group's height tracks its
cell count.

## See also

- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/config_guides/multiquantitative_track)
- [](/docs/config/multiwiggleadapter)
- [](/docs/models/multilinearwiggledisplay)
- [](/docs/user_guides/clustering)
- [](/docs/tutorials/chromhmm)

## References

Pseudobulk / coverage tools:

- [SnapATAC2 `export_coverage`](https://scverse.org/SnapATAC2/version/dev/api/_autosummary/snapatac2.ex.export_coverage.html)
- [ArchR: exporting pseudobulk BigWigs (`getGroupBW`)](https://www.archrproject.com/bookdown/exporting-pseudo-bulked-data-to-a-bigwig-file.html)
- [deepTools `bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
  and its
  [normalization methods](https://github.com/deeptools/deepTools/wiki/Normalizations)
- [sinto `filterbarcodes` (split BAM by barcode/label)](https://timoast.github.io/sinto/basic_usage.html)

Reference datasets:

- [SnapATAC2's 5k PBMC scATAC dataset](https://scverse.org/SnapATAC2/api/_autosummary/snapatac2.datasets.pbmc5k.html),
  the 10x Genomics experiment this page pseudobulks, in its clustered and
  cell-type-annotated form
- [CATlas: a single-cell atlas of chromatin accessibility in the human genome (Zhang et al., Cell 2021)](https://www.sciencedirect.com/science/article/pii/S0092867421012794)
  · [resource portal](https://www.catlas.org/), the published atlas a track
  reads without building anything

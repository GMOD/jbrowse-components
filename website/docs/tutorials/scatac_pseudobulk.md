---
title: Single-cell ATAC pseudobulk tracks
description:
  Aggregate single-cell ATAC into per-cell-type coverage BigWigs and load them
  as one MultiWiggle track
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

JBrowse does not process single-cell data itself. To view single-cell ATAC-seq
(scATAC-seq) the way the gallery's "Single-cell ATAC by cell type (CATlas)" card
does — one coverage row per cell type — you first **pseudobulk** the data
outside JBrowse: group cells by cluster or cell-type label, sum their reads into
one coverage track per group, and save each as a BigWig. You then load all the
BigWigs as a single **MultiWiggle** track, which stacks one row per file.

<Figure caption="The CATlas single-cell ATAC atlas as pseudobulk rows: one coverage BigWig per cell type, loaded as a single MultiWiggle track (multirowxy) across the imprinted INS/IGF2 region on 11p15.5, where the insulin-producing Beta cell row shows accessibility over INS." src="/img/gallery/scatac_catlas.png" />

This guide covers producing the per-group BigWigs and configuring the JBrowse
track. It assumes you already have clustered scATAC data (a fragments file or a
BAM plus a per-barcode cell-type label) from a tool like 10x Cell Ranger ATAC,
ArchR, Signac, or SnapATAC2.

Working in a notebook? If you pseudobulk with SnapATAC2 (Python) or ArchR (R),
you can compute these BigWigs and view them inline in the same session through
the [JBrowse Jupyter / anywidget interface](/docs/jbrowse_jupyter) (or
[JBrowseR](/docs/jbrowser)).

## The pseudobulk idea

A scATAC experiment is a sparse per-cell signal — too sparse to plot per cell.
Pseudobulking collapses each group of cells (a cluster or annotated cell type)
into one aggregated coverage profile, giving a dense, bulk-ATAC-like track per
group. With one BigWig per group loaded as rows of a single track, open
chromatin shared across cell types versus specific to one lines up
column-by-column at any locus.

Two normalization points matter so rows are comparable to each other:

- Groups contain different numbers of cells and different total reads. Normalize
  each track (CPM / RPKM, or per-cell-count) so a tall peak means "more
  accessible", not "more cells in this group".
- Pick a bin size. Smaller bins (10–25 bp) preserve peak shape at the cost of
  larger files. Larger bins (50–100 bp) are smaller and fine for a zoomed-out
  overview. 10–25 bp is typical for ATAC.

## Generating per-group BigWigs

Pick the path that matches where your data already lives. All paths end in one
`.bw` per cell type.

### SnapATAC2 (from an AnnData of fragments)

SnapATAC2's `export_coverage` splits cells by a metadata column and writes one
normalized BigWig per group in a single call. (It supersedes the older
`export_bigwig`.)

```python
import snapatac2 as snap

# adata: an AnnData with fragments imported and a cell-type/cluster label in obs
snap.ex.export_coverage(
    adata,
    groupby="cell_type",     # column in adata.obs to split on
    bin_size=25,             # bp per bin
    normalization="RPKM",    # comparable across groups
    blacklist="hg38-blacklist.bed",  # optional ENCODE blacklist
    out_dir="bw/",
    suffix=".bw",
    n_jobs=8,
)
# writes bw/<cell_type>.bw, one per group
```

### ArchR (from an ArchRProject)

ArchR's `getGroupBW` groups cells, sums their Tn5 insertions, and exports one
BigWig per group. `normMethod = "ReadsInTSS"` normalizes at the pseudobulk level
by signal-in-TSS (accounting for both depth and data quality). `"nCells"` or
`"nFrags"` are alternatives.

```r
library(ArchR)

getGroupBW(
  ArchRProj = proj,
  groupBy   = "CellType",     # a cellColData column
  normMethod = "ReadsInTSS",
  tileSize  = 25,
  maxCells  = 1000            # subsample very large groups if desired
)
# writes GroupBigWigs/<CellType>-TileSize-25-normMethod-ReadsInTSS.bw
```

### Split a BAM by cell type, then deepTools (Signac / Cell Ranger / generic)

If you have a position-sorted BAM with cell barcodes in a tag (e.g. `CB`) — the
Cell Ranger ATAC output, or what a Signac workflow starts from — split it into
one BAM per cell type using a barcode→label table, then run `bamCoverage` on
each.

```bash
# barcodes.tsv: two columns, "<barcode><TAB><cell_type>"
sinto filterbarcodes \
  -b possorted_bam.bam \
  -c barcodes.tsv \
  --barcodetag CB \
  -p 8
# -> one BAM per distinct cell_type label, e.g. Beta.bam, Alpha.bam, ...

for bam in *.bam; do
  name=$(basename "$bam" .bam)
  bamCoverage \
    --bam "$bam" \
    -o "bw/${name}.bw" \
    --binSize 25 \
    --normalizeUsing CPM \
    --extendReads \
    -p 8
done
```

`--normalizeUsing CPM` (or `RPKM`) makes rows comparable across groups. Use
`RPGC` (1x depth) only if you also pass `--effectiveGenomeSize` (GRCh38:
`2913022398`). CPM/RPKM do not need it. `--extendReads` extends paired-end
fragments to their full length.

### Manual fallback (fragments.tsv.gz → bedGraph → bigWig)

Without SnapATAC2/ArchR, split a 10x-style `fragments.tsv.gz` by cluster with a
barcode→cluster map, then convert each group with standard tools:

```bash
# clusters.tsv: two columns, "<barcode><TAB><cluster>"
# fragments.tsv.gz columns: chrom  start  end  barcode  count

# 1. split fragments into one BED per cluster (keep only that cluster's barcodes)
for cl in $(cut -f2 clusters.tsv | sort -u); do
  awk -v cl="$cl" 'NR==FNR{if($2==cl)keep[$1];next} ($4 in keep){print $1"\t"$2"\t"$3}' \
    clusters.tsv <(zcat fragments.tsv.gz) \
    | sort -k1,1 -k2,2n > "$cl.bed"
done

# 2. per cluster: genome-coverage bedGraph -> bigWig
for bed in *.bed; do
  name=$(basename "$bed" .bed)
  bedtools genomecov -bg -i "$bed" -g hg38.chrom.sizes \
    | sort -k1,1 -k2,2n > "$name.bedGraph"
  bedGraphToBigWig "$name.bedGraph" hg38.chrom.sizes "$name.bw"
done
```

This route is unnormalized. Scale each group (e.g. by 1e6 / total fragments for
CPM) before `bedGraphToBigWig` if you need comparable rows.

## Loading the BigWigs as a MultiWiggle track

In JBrowse, all the per-cell-type BigWigs go into **one** track: a
`MultiQuantitativeTrack` whose `MultiWiggleAdapter` holds one `BigWigAdapter`
per file. Each subadapter carries a `name` (the row label), an optional `color`,
and an optional `group` (which seeds the sidebar clustering tree).

### Via the UI

Track menu → **Add track**, switch the workflow to **Add multi-wiggle track**,
and paste your BigWig URLs one per line (or a JSON array of subadapter objects).
JBrowse builds the `MultiQuantitativeTrack` for you. This is the fastest way to
try a set of files. Export the session to get the JSON config. On JBrowse
Desktop the same workflow loads the `.bw` files straight from local disk with no
web server ([desktop quickstart](/docs/quickstart_desktop)).

### Via config JSON

Add a track object to your config's `tracks` array. Its `assemblyNames` must
match an assembly already configured in JBrowse (the BigWigs above were built
against `hg38`); if you don't have it set up yet, see the
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
        "name": "Beta (insulin)",
        "group": "Islet",
        "color": "#f58231",
        "bigWigLocation": { "uri": "https://example.com/bw/Beta.bw" }
      },
      {
        "type": "BigWigAdapter",
        "name": "Alpha (glucagon)",
        "group": "Islet",
        "color": "#e6194b",
        "bigWigLocation": { "uri": "https://example.com/bw/Alpha.bw" }
      },
      {
        "type": "BigWigAdapter",
        "name": "CD8 T cell",
        "group": "Immune",
        "color": "#4363d8",
        "bigWigLocation": { "uri": "https://example.com/bw/CD8T.bw" }
      }
    ]
  }
}
```

If you don't need per-row names/colors, the `bigWigs` shorthand takes a plain
array of URLs (the row label is derived from each filename):

```json
"adapter": {
  "type": "MultiWiggleAdapter",
  "bigWigs": [
    "https://example.com/bw/Beta.bw",
    "https://example.com/bw/Alpha.bw",
    "https://example.com/bw/CD8T.bw"
  ]
}
```

### The CATlas gallery track

The gallery card is exactly this track type, pointing at CATlas (Zhang et
al. 2021) per-cell-type pileup BigWigs, which are hosted publicly (hg38) at

```
https://decoder-genetics.wustl.edu/catlasv1/humanenhancer/data/bw/<CellType>.bw
```

for example `.../bw/Beta_1.bw`, `.../bw/Alpha_1.bw`, `.../bw/Acinar.bw`. Each
subadapter is a `BigWigAdapter` with a `name`, a `group` (islet / exocrine /
immune / …), a `color`, and that URI — the same structure as the example above,
so you can point a `MultiWiggleAdapter` straight at them without regenerating
anything.

## Rendering options

The display is a `MultiLinearWiggleDisplay`. Its
[`defaultRendering`](/docs/config/multilinearwiggledisplay/#slot-defaultrendering)
slot chooses how the subtracks are drawn — set it under the track's `displays`
(or the `displayDefaults` shorthand), or switch it live from the track menu.

- **`multirowxy`** — one stacked XY-plot row per cell type. This is the "one
  coverage row per cell type" look of the gallery card, and is best for
  comparing peak shape across many groups.
- **`multirowdensity`** — one row per cell type, but score mapped to color
  intensity instead of bar height. Compact, and good for a heatmap-style view of
  many cell types at once.
- **`multixyplot`** — all cell types overlaid in a single shared plot (one Y
  axis). Good for a few groups you want superimposed rather than stacked.
- `multirowline` / `multirowscatter` and `multiline` / `multiscatter` are the
  line and scatter variants of the stacked and overlapping layouts.

Single-source names (`xyplot`, `density`, …) copied from a normal wiggle track
are automatically remapped to their multi-row equivalents, so an accidental
`"xyplot"` still loads.

Other useful controls:

- **height** — total track height in pixels (the
  [`height`](/docs/config/multilinearwiggledisplay/#slot-height) slot). Raise it
  when you have many rows.
- **summaryScoreMode** — `avg`, `min`, `max`, or `whiskers` (the
  [`summaryScoreMode`](/docs/config/multilinearwiggledisplay/#slot-summaryscoremode)
  slot) for how each bin's summary is drawn when zoomed out.
- **Clustering → "Cluster rows by score..."** — a track-menu action that
  reorders the rows by hierarchical clustering of the score matrix over the
  region in view, drawing a dendrogram in the sidebar. Cell types with similar
  accessibility profiles at that locus sort next to each other. See the
  [multi-quantitative track guide](/docs/config_guides/multiquantitative_track)
  for the clustering workflow.

Example display config that starts taller and in density mode:

```json
"displays": [
  {
    "type": "MultiLinearWiggleDisplay",
    "displayId": "scatac_pseudobulk-display",
    "defaultRendering": "multirowdensity",
    "height": 400
  }
]
```

## See also

- [Multi-quantitative track configuration](/docs/config_guides/multiquantitative_track)
  — the MultiWiggle track type in depth, including in-app clustering
- [MultiWiggleAdapter config](/docs/config/multiwiggleadapter) — the subadapter
  schema used above
- [MultiLinearWiggleDisplay model](/docs/models/multilinearwiggledisplay) — the
  rendering-mode options detailed in this tutorial
- [ChromHMM chromatin states](/docs/tutorials/chromhmm) — the discrete-interval
  analog of this one-row-per-group pattern, using multi-row feature display
  instead of MultiWiggle

## Sources

Pseudobulk / coverage tools:

- [SnapATAC2 `export_coverage`](https://scverse.org/SnapATAC2/version/dev/api/_autosummary/snapatac2.ex.export_coverage.html)
- [ArchR — exporting pseudobulk BigWigs (`getGroupBW`)](https://www.archrproject.com/bookdown/exporting-pseudo-bulked-data-to-a-bigwig-file.html)
- [deepTools `bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
  and its
  [normalization methods](https://github.com/deeptools/deepTools/wiki/Normalizations)
- [sinto `filterbarcodes` (split BAM by barcode/label)](https://timoast.github.io/sinto/basic_usage.html)

Reference dataset:

- [CATlas — a single-cell atlas of chromatin accessibility in the human genome (Zhang et al., Cell 2021)](https://www.sciencedirect.com/science/article/pii/S0092867421012794)
  · [resource portal](https://www.catlas.org/)

---
title: Single-cell ATAC pseudobulk
description: Aggregate single-cell ATAC into per-cell-type coverage BigWigs
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

**TL;DR:** pseudobulk outside JBrowse, pooling each cluster's cells into one
coverage BigWig, then load the whole set as a single MultiWiggle track, which
draws one row per file.

## Prerequisites

Nothing to install to read along: the figures come from hosted CATlas data.

To build the tracks you need cells already clustered and labeled, which means
either a fragments file (or a barcoded BAM) plus a barcode-to-label table, or
the project object your analysis tool already holds: an `AnnData` in SnapATAC2
(Python), an `ArchRProject` in ArchR, or a Seurat/Signac object in R. The
pseudobulk step below runs in that same environment, so the BigWigs it writes
can also be viewed inline through the
[JBrowse Jupyter / anywidget interface](/docs/jbrowse_jupyter) (or
[](/docs/jbrowser)) without leaving the session. You'll also need a JBrowse
instance to load the finished BigWigs into.

One ATAC cell contributes only a few thousand fragments, so a coverage track of
a single cell is almost entirely zero and no locus reads as open or closed.
Pseudobulking is the standard answer: take the labels your clustering already
assigned, pool every fragment belonging to a label into one profile, and each
cell type comes out as a dense track that looks like a bulk ATAC experiment run
on that cell type alone. Ten cell types give ten BigWigs, JBrowse stacks them as
ten rows of one track, and accessibility restricted to one lineage reads as a
peak present in a single row and flat in the rest.

<Figure caption="The CATlas single-cell ATAC atlas as pseudobulk rows: one coverage BigWig per cell type, loaded as a single MultiWiggle track (multirowxy) across the INS/IGF2 region on 11p15.5, where the Beta cell row shows accessibility over INS. Source data: CATlas (Zhang et al. 2021), catlas.org." src="/img/gallery/scatac_catlas.png" />

Clustering and cell-type labeling stay upstream, in Cell Ranger ATAC, ArchR,
Signac, or SnapATAC2. This tutorial starts from what those produce and does
three things with it:

- **pseudobulk**: split fragments by label, pool, normalize, and bin each group
  into a BigWig
- **load**: point one `MultiWiggleAdapter` at the whole set, so N cell types
  stay one track with one config, one height, and one shared score axis
- **read it**: stacked rows, row clustering, and the rendering modes that suit
  many rows

[Reproduce it end to end](#reproduce-it-end-to-end) runs the whole path on a
public 5k-PBMC dataset, and the sections before it cover each piece against your
own data.

## Generating per-group BigWigs

Pick the path that matches where your data already lives. All paths end in one
`.bw` per cell type.

Two settings decide whether the rows can be compared to each other, and every
path below has to make both calls:

- **Normalization.** Groups differ in cell count and in total fragments, so
  normalize each track (CPM / RPKM, or per-cell-count). Without it a tall peak
  can just mean "more cells in this group".
- **Bin size.** Smaller bins (10-25bp) preserve ATAC peak shape at the cost of
  file size; larger bins (50-100bp) are smaller and fine zoomed out. 10-25bp is
  typical.

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
    n_jobs=2,                # each worker holds a genome-wide coverage vector
)
# writes bw/<cell_type>.bw, one per group, keyed by group in the returned dict
```

Keep `n_jobs` low: at the default of 8 the BigWig writer died partway through
the groups on a 30GB machine, where two workers wrote all of them in about a
minute.

`groupby` is the whole decision: pass the cluster column (`"leiden"`) to get one
row per cluster, or the annotated column (`"cell_type"`) to get one row per cell
type. Nothing else in the workflow changes.

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

If you have a position-sorted BAM with cell barcodes in a tag (e.g. `CB`), such
as the Cell Ranger ATAC output or what a Signac workflow starts from, split it
into one BAM per cell type using a barcode→label table, then run `bamCoverage`
on each.

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

# split fragments into one BED per cluster (keep only that cluster's barcodes)
for cl in $(cut -f2 clusters.tsv | sort -u); do
  awk -v cl="$cl" 'NR==FNR{if($2==cl)keep[$1];next} ($4 in keep){print $1"\t"$2"\t"$3}' \
    clusters.tsv <(zcat fragments.tsv.gz) \
    | sort -k1,1 -k2,2n > "$cl.bed"
done

# per cluster: genome-coverage bedGraph -> bigWig
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

In JBrowse, all the per-cell-type BigWigs go into one track: a
`MultiQuantitativeTrack` whose `MultiWiggleAdapter` holds one `BigWigAdapter`
per file. Each subadapter carries a `name` (the row label), an optional `color`,
and an optional `group` (which seeds the sidebar clustering tree).

<Figure caption="CATlas single-cell ATAC over the albumin (ALB) gene on chr4, one accessibility row per cell type. The Hepatocyte row is open across the whole locus while the other 15 cell types stay flat, the cell-type-restricted accessibility that a pseudobulk-by-cell-type track makes visible at a glance." src="/img/scatac/alb_hepatocyte.png" />

### Via the UI

From the "Add track" workflow, switch to "Add multi-wiggle track" and paste your
BigWig URLs one per line (or a JSON array of subadapter objects). JBrowse builds
the `MultiQuantitativeTrack` for you. This is the fastest way to try a set of
files. Export the session to get the JSON config. On JBrowse Desktop the same
workflow loads the `.bw` files straight from local disk with no web server
([desktop quickstart](/docs/quickstart_desktop)).

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
config below) instead of the comma list. Either way the subadapters are drawn in
the order given, so listing them in your analysis tool's cluster order keeps
related lineages adjacent rather than alphabetized.

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
        "name": "Beta (insulin)",
        "group": "Islet",
        "color": "#f58231",
        "uri": "https://example.com/bw/Beta.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "Alpha (glucagon)",
        "group": "Islet",
        "color": "#e6194b",
        "uri": "https://example.com/bw/Alpha.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CD8 T cell",
        "group": "Immune",
        "color": "#4363d8",
        "uri": "https://example.com/bw/CD8T.bw"
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
immune / …), a `color`, and that URI, the same structure as the example above,
so you can point a `MultiWiggleAdapter` straight at them without regenerating
anything.

## Reproduce it end to end

One script runs the whole path on a public dataset,
[`build_scatac_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scatac_pseudobulk.sh):

```bash
bash scripts/build_scatac_pseudobulk.sh    # builds ./scatac_pseudobulk_build
npx --yes serve scatac_pseudobulk_build/jbrowse2
```

<Figure caption="What the script produces, over CD8A: 12 per-cell-type BigWigs from the 10x 5k PBMC dataset as one MultiQuantitativeTrack, each row keeping the color and the cluster order the single-cell object gave it. The CD8 Memory, CD8 Naive, and MAIT rows carry the accessibility here while the B cell and monocyte rows stay flat." src="/img/scatac/pbmc5k_cd8a.png" />

The input is SnapATAC2's annotated release of the 10x 5k-PBMC scATAC dataset,
which is that tool's
[standard pipeline](https://scverse.org/SnapATAC2/tutorials/pbmc.html) and
[cell-type annotation](https://scverse.org/SnapATAC2/tutorials/annotation.html)
tutorials already run: fragments imported, cells QC-filtered and clustered, and
each cluster labeled by transferring cell types from a matched multiome
reference. Its `AnnData` therefore carries per-barcode fragments alongside an
`obs["cell_type"]` call, which is the pair pseudobulking needs, so the script's
own work is short:

- `export_coverage(groupby="cell_type", bin_size=25, normalization="RPKM")`,
  which writes one BigWig per cell type into `bw/`
- a `sources.json` of subadapters, taking each row's label, color, and position
  from the same object, so the rows keep the colors and the cluster order the
  single-cell analysis gave them
- `jbrowse create` plus `add-assembly` for hg38 and a RefSeq gene track, then
  the one `MultiQuantitativeTrack` those subadapters make up

Everything upstream of `export_coverage` is the part a genome browser does not
do, and this dataset is a convenient place to skip it. Running it on your own
experiment means substituting your labeled object at that one call.

## Rendering options

The display is a `MultiLinearWiggleDisplay`. Its
[`defaultRendering`](/docs/config/multilinearwiggledisplay/#slot-defaultrendering)
slot chooses how the subtracks are drawn. Set it under the track's `displays`
(or the `displayDefaults` shorthand), or switch it live from the track menu.

- `multirowxy` - one stacked XY-plot row per cell type. This is the "one
  coverage row per cell type" look of the gallery card, and is best for
  comparing peak shape across many groups.
- `multirowdensity` - one row per cell type, but score mapped to color intensity
  instead of bar height. Compact, and good for a heatmap-style view of many cell
  types at once.
- `multixyplot` - all cell types overlaid in a single shared plot (one Y axis).
  Good for a few groups you want superimposed rather than stacked.
- `multirowline` / `multirowscatter` and `multiline` / `multiscatter` are the
  line and scatter variants of the stacked and overlapping layouts.

Single-source names (`xyplot`, `density`, …) copied from a normal wiggle track
are automatically remapped to their multi-row equivalents, so an accidental
`"xyplot"` still loads.

Other useful controls:

- `height` - total track height in pixels (the
  [`height`](/docs/config/multilinearwiggledisplay/#slot-height) slot). Raise it
  when you have many rows.
- `summaryScoreMode` - `avg`, `min`, `max`, or `whiskers` (the
  [`summaryScoreMode`](/docs/config/multilinearwiggledisplay/#slot-summaryscoremode)
  slot) for how each bin's summary is drawn when zoomed out.
- The "Cluster rows by score..." clustering action in the track menu reorders
  the rows by hierarchical clustering of the score matrix over the region in
  view, drawing a dendrogram in the sidebar. Cell types with similar
  accessibility profiles at that locus sort next to each other. See the
  [multi-quantitative track guide](/docs/config_guides/multiquantitative_track)
  for the clustering workflow.

Example display config that starts taller and in density mode:

```json
"displays": [
  {
    "type": "MultiLinearWiggleDisplay",
    "defaultRendering": "multirowdensity",
    "height": 400
  }
]
```

## See also

- [Multi-quantitative track configuration](/docs/config_guides/multiquantitative_track)
- [MultiWiggleAdapter config](/docs/config/multiwiggleadapter)
- [MultiLinearWiggleDisplay model](/docs/models/multilinearwiggledisplay)
- [](/docs/tutorials/chromhmm)

## Sources

Pseudobulk / coverage tools:

- [SnapATAC2 `export_coverage`](https://scverse.org/SnapATAC2/version/dev/api/_autosummary/snapatac2.ex.export_coverage.html)
- [ArchR: exporting pseudobulk BigWigs (`getGroupBW`)](https://www.archrproject.com/bookdown/exporting-pseudo-bulked-data-to-a-bigwig-file.html)
- [deepTools `bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html)
  and its
  [normalization methods](https://github.com/deeptools/deepTools/wiki/Normalizations)
- [sinto `filterbarcodes` (split BAM by barcode/label)](https://timoast.github.io/sinto/basic_usage.html)

Reference datasets:

- [CATlas: a single-cell atlas of chromatin accessibility in the human genome (Zhang et al., Cell 2021)](https://www.sciencedirect.com/science/article/pii/S0092867421012794)
  · [resource portal](https://www.catlas.org/)
- [SnapATAC2's 5k PBMC scATAC dataset](https://scverse.org/SnapATAC2/api/_autosummary/snapatac2.datasets.pbmc5k.html),
  the 10x Genomics experiment the build script pseudobulks, in its clustered and
  cell-type-annotated form

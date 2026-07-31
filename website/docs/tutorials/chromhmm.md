---
title: ChromHMM chromatin states
description: Paint many-cell-type ChromHMM states in one multi-row track
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

**TL;DR:** merge many per-cell-type ChromHMM segmentation BEDs into one file
with a `cellType` column, then a `LinearMultiRowFeatureDisplay` partitions it
into one color-coded row per cell type from a single track, adapter, and fetch.

## Prerequisites

- `wget` and htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install wget tabix` covers `wget` and htslib; `node`
comes from [nodejs.org](https://nodejs.org/).

## Many cell types in one track

[ChromHMM](https://compbio.mit.edu/ChromHMM/) segments the genome into chromatin
states (active promoter, strong enhancer, heterochromatin, ...) from
combinations of histone-mark ChIP-seq. A segmentation is produced _per cell
type_, so a useful browser track stacks many cell types on top of each other at
the same locus, one labeled row per cell type, each painted with the ChromHMM
state colors.

ChromHMM's output is a stack of separate BED files (`Gm12878.bed`, `K562.bed`,
...). Each is a BED9 whose `name` column holds the state (e.g.
`1_Active_Promoter`) and whose `itemRgb` column carries the state color. Adding
one JBrowse track per file is impractical at 9 cell types and worse at 127, so
instead we merge them into a single file with an extra `cellType` column and let
the multi-row feature display split that one track back into a labeled sub-row
per cell type. Every row shares one config, one adapter, and one fetch.

<Figure src="/img/chromhmm.png" caption="Roadmap Epigenomics 15-state ChromHMM across 127 epigenomes as a single multi-row track, with NCBI RefSeq genes above for context. Each row is one epigenome, each block is painted by the file's own itemRgb, and the state key on the right is derived from the data."/>

## Reproduce it end to end

One script does the whole path,
[`build_chromhmm_multirow.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_chromhmm_multirow.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_chromhmm_multirow.sh
bash build_chromhmm_multirow.sh         # builds ./chromhmm_build/jbrowse2
npx --yes serve chromhmm_build/jbrowse2 # then open the printed URL
```

It downloads the nine
[UCSC ENCODE Broad HMM](http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm/)
15-state segmentation BEDs (hg19, one per cell type), merges them into a single
`cellType`-tagged BED, bgzips and tabixes it, downloads JBrowse, and writes the
`config.json` described below, opening on the HOXA cluster.

Two properties of the merged file matter for loading it. Each line is standard
BED9 plus one trailing string field, the cell-type label that becomes a row:

```
#chrom  chromStart  chromEnd  name               score  strand  thickStart  thickEnd  itemRgb      cellType
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  GM12878
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  K562
```

And that `#`-prefixed defline is part of the file, so the adapter takes the
column names from the data rather than from the config. `tabix -p bed` keeps `#`
lines as the header, and the script writes the defline outside the coordinate
sort so it stays first.

The merge output is already coordinate-sorted, so indexing it is just `bgzip`
plus `tabix -p bed`: JBrowse fetches any region on demand, with no bigBed
conversion, no autoSql schema, and no chrom.sizes file. To skip the build
entirely, the finished 9-cell-type file is also hosted as a bigBed at
`https://jbrowse.org/demos/chromhmm/wgEncodeBroadHmm.multirow.bb`, which carries
the same column names in its embedded autoSql.

## Configure the multi-row feature display

Add a `FeatureTrack` with a `BedTabixAdapter`, and give it a
`LinearMultiRowFeatureDisplay` that partitions on the `cellType` field. The
track references the `hg19` assembly, so set that up first if you haven't, see
the [assemblies configuration guide](/docs/config_guides/assemblies):

```json
{
  "type": "FeatureTrack",
  "trackId": "broad_chromhmm_multirow_hg19",
  "name": "ChromHMM chromatin state (Broad ENCODE, 9 cell types)",
  "assemblyNames": ["hg19"],
  "category": ["ENCODE", "Chromatin state"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "wgEncodeBroadHmm.multirow.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "cellType",
      "rowOrder": [
        "GM12878",
        "H1-hESC",
        "K562",
        "HepG2",
        "HUVEC",
        "HMEC",
        "HSMM",
        "NHEK",
        "NHLF"
      ],
      "height": 200
    }
  ]
}
```

The adapter's `uri` shorthand resolves the `.bed.gz.tbi` beside the file, which
leaves two display settings to write:

- [`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
  is the feature attribute to split rows by. Every distinct `cellType` value
  becomes its own labeled sub-row, so a 9-cell-type file draws as 9 stacked
  rows.
- [`rowOrder`](/docs/config/linearmultirowfeaturedisplay/#slot-roworder) pins
  the sub-rows to a chosen order, here the ENCODE tier ordering rather than the
  alphabetical order the display falls back to.

[`rowHeight`](/docs/config/linearmultirowfeaturedisplay/#slot-rowheight) is left
at its auto-fit default, which divides the track height evenly across however
many rows the file turns out to have, so no row scrolls out of view.

Nothing names the columns and nothing sets a color. The defline handles the
first, so the adapter's
[`columnNames`](/docs/config/bedtabixadapter/#slot-columnnames) is for files
that don't carry one. And a feature with an `itemRgb` is painted with it
automatically, so every block gets its ChromHMM state color straight from the
file; set the [`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color)
slot only to override that.

**Using JBrowse Desktop?** These steps work unchanged. Desktop opens
`wgEncodeBroadHmm.multirow.bed.gz` straight from your local disk (point `uri` at
the local path), no web server needed. See the
[desktop quickstart](/docs/quickstart_desktop).

## Read it

The state colors are the data, so the display derives the key from them: one
legend entry per distinct color, labeled with the first state name seen in that
color. Nothing declares it, and it can't disagree with what's painted. States
that share a color collapse into one entry, which in the Broad 15-state model
pairs `4_Strong_Enhancer` with `5_`, `6_Weak_Enhancer` with `7_`, and the two
transcription states with each other. Turn the key off with **Show... → Show
legend** in the track menu, or spell it out yourself with the
[`legend`](/docs/config/linearmultirowfeaturedisplay/#slot-legend) slot.

Most of any segmentation is quiescent or heterochromatic, which is what the pale
background of the figure is. The track menu's **Categories** submenu has a
checkbox per legend entry: unchecking the quiescent and repressed states drops
them everywhere in the painting, leaving only promoters, enhancers, and
transcription. It applies at render time with no refetch, and because entries
are keyed by color, one uncheck hides every state sharing that color.

Two more track-menu actions turn the painting into a comparison:

- **Clustering → Cluster rows by similarity** reorders the rows by their state
  colors across the region in view and draws the dendrogram in the sidebar. On
  the 127-epigenome track below this is the whole point: related tissues group
  themselves at whatever locus you're looking at, rather than sitting in a
  hand-written order.
- Right-click a column of the painting and pick **Sort rows by color here** to
  rank the rows by the state each one carries at that base. On a promoter, the
  cell types with an active TSS rise to the top.

The script opens on the HOXA cluster (`chr7:27,050,000-27,300,000`) because it
shows both at once: the stem-cell line (H1-hESC) reads as Polycomb-repressed
across the whole cluster while the differentiated lines carry active promoter
and transcription states over the genes each of them uses.

## Scaling up: 127 epigenomes

The same recipe scales to the
[Roadmap Epigenomics](https://egg2.wustl.edu/roadmap/web_portal/chr_state_learning.html)
15-state model across 127 epigenomes, the track in the figure above. The only
difference is 127 input files and a longer `rowOrder`. Because the multi-row
display fetches and lays out one file, 127 epigenomes is still one track, one
adapter, one fetch, not 127 tracks.

At that row count `rowOrder` is 127 lines of config whose only job is to keep
related tissues adjacent, which is exactly what **Cluster rows by similarity**
derives from the data. Leave `rowOrder` out and cluster instead when the
grouping you want depends on the locus rather than on a fixed publication order.

## See also

- [](/docs/tutorials/tcga_cohort_cnv), the same display colored from a numeric
  column instead of `itemRgb`
- [](/docs/tutorials/bxd_qtl), the same display for strain genotypes, alongside
  a QTL scan
- [](/docs/tutorials/analyze_trio), the same display for inheritance painting
- [](/docs/tutorials/scatac_pseudobulk)
- [](/docs/user_guides/clustering)
- [Configuring tracks](/docs/config_guides/tracks)

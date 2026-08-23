---
title: ChromHMM chromatin states
description: Paint many-cell-type ChromHMM states in one multi-row track
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
data: download
---

**TL;DR:** ChromHMM labels each region of the genome with a chromatin state,
promoter, enhancer, heterochromatin and so on, once per cell type. We merge many
per-cell-type segmentation BEDs into one file, which JBrowse draws as a single
track with one color-coded row per cell type.

## Prerequisites

- `wget` and htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)
- `python3`, for the [127-epigenome build](#reproduce-it-end-to-end) only

On Debian/Ubuntu, `apt install wget tabix` covers `wget` and htslib; `node`
comes from [nodejs.org](https://nodejs.org/).

## Where the data comes from

Two hg19 ChromHMM releases, both 15-state segmentations: UCSC's nine-cell-type
ENCODE Broad HMM set, and the Roadmap Epigenomics compendium across 127
epigenomes.

- the nine ENCODE Broad HMM segmentation BEDs, one per cell type, merged into
  the multi-row file below:
  http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm/
- the Roadmap segmentations, fetched either individually or as the whole
  127-epigenome tarball:
  https://egg2.wustl.edu/roadmap/data/byFileType/chromhmmSegmentations/ChmmModels/coreMarks/jointModel/final/
- the row labels and tissue groups the `rowGroups` stripe reads,
  `EID_metadata.tab`:
  https://egg2.wustl.edu/roadmap/data/byFileType/metadata/EID_metadata.tab
- the state colors, since the Roadmap segmentations themselves carry none:
  https://egg2.wustl.edu/roadmap/data/byFileType/chromhmmSegmentations/ChmmModels/coreMarks/jointModel/final/colormap_15_coreMarks.tab
- both merged files, rehosted as bigBeds so the tracks below load without the
  build: https://jbrowse.org/demos/chromhmm/wgEncodeBroadHmm.multirow.bb and
  https://jbrowse.org/demos/chromhmm/roadmap_15state_127epigenomes.bb

## Many cell types in one track

[ChromHMM](https://compbio.mit.edu/ChromHMM/) segments the genome into chromatin
states (active promoter, strong enhancer, heterochromatin, ...) from
combinations of histone-mark ChIP-seq. A segmentation is produced _per cell
type_, so a useful browser track stacks many cell types on top of each other at
the same locus, one labeled row per cell type, each painted with the ChromHMM
state colors.

ChromHMM's output is a stack of separate BED files (`Gm12878.bed`, `K562.bed`,
...). Each is a BED9 whose `name` column holds the state (e.g.
`1_Active_Promoter`) and whose `itemRgb` column carries the state color. Merging
them into a single file with an extra `cellType` column lets the multi-row
feature display split that one track into a labeled sub-row per cell type, so 9
cell types (or 127) share one config, one adapter, and one fetch.

HOXA is the window the build script opens on. The genes are transcribed in the
order they sit in, so a cell type opens the stretch matching its own position
along the body axis and holds the rest under Polycomb, and most of the rows that
open the cluster at all stop between HOXA7 and HOXA9.

The two cell types that open the posterior genes are the mesodermal pair, HUVEC
and HSMM. The keratinocyte, lung-fibroblast and mammary lines stop at HOXA7, and
GM12878 and K562 are blood and hold the whole cluster shut. H1-hESC is
pluripotent, and its magenta is `3_Poised_Promoter`, the bivalent state HOX
clusters are held in before a lineage commits.

## What the merged file holds

The nine
[UCSC ENCODE Broad HMM](http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm/)
15-state segmentation BEDs (hg19, one per cell type) concatenate into a single
`cellType`-tagged BED, which [the build script](#reproduce-it-end-to-end) does
in one pass. Two properties of that merged file matter for loading it. Each line
is standard BED9 plus one trailing string field, the cell-type label that
becomes a row:

```
#chrom  chromStart  chromEnd  name               score  strand  thickStart  thickEnd  itemRgb      cellType
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  GM12878
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  K562
```

That `#`-prefixed defline is part of the file, so the adapter takes the column
names from the data. The merge is one pass over the per-cell-type BEDs:

<!-- from: scripts/build_chromhmm_multirow.sh -->

```bash
# awk appends each file's own name as the row label, so Gm12878.bed.gz labels
# its segments Gm12878
{
  printf '#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\tcellType\n'
  for f in *.bed.gz; do
    zcat "$f" | awk -v c="${f%%.*}" 'BEGIN{OFS="\t"} {print $0, c}'
  done
} > multirow.bed

# `sort-bed` is `sort -k1,1 -k2,2n` with the #-defline kept on top, and pins
# LC_ALL=C so nine files' worth of refnames group the same way everywhere
jbrowse sort-bed multirow.bed | bgzip > multirow.bed.gz
tabix -p bed multirow.bed.gz
```

Both merged files are also hosted as bigBeds, for reading with nothing built
(see [Where the data comes from](#where-the-data-comes-from)). Those take a
[`BigBedAdapter`](/docs/config/bigbedadapter), which is what the second track
config below names.

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
  the sub-rows to a chosen order, here the ENCODE tier ordering; the display
  falls back to alphabetical.

[`rowHeight`](/docs/config/linearmultirowfeaturedisplay/#slot-rowheight) is left
at its auto-fit default, which divides the track height evenly across however
many rows the file turns out to have, so no row scrolls out of view.

The defline names the columns, so the adapter's
[`columnNames`](/docs/config/bedtabixadapter/#slot-columnnames) is for files
that don't carry one. A feature with an `itemRgb` is painted with it, so every
block gets its ChromHMM state color straight from the file; the
[`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color) slot overrides
that.

These steps work unchanged on [JBrowse Desktop](/docs/quickstart_desktop), which
opens `wgEncodeBroadHmm.multirow.bed.gz` straight from local disk with no web
server; point `uri` at the local path.

## The legend, filtering and row order

The display derives the key from the state colors: one entry per distinct color,
labeled with the first state name seen in it. States that share a color collapse
into one entry, which in the Broad 15-state model pairs `4_Strong_Enhancer` with
`5_`, `6_Weak_Enhancer` with `7_`, and `9_Txn_Transition` with
`10_Txn_Elongation`. `13_Heterochrom/lo` and both `Repetitive/CNV` states share
one grey, so unchecking that entry hides all three. Turn the key off with
**Show... → Show legend** in the track menu, or spell it out with the
[`legend`](/docs/config/linearmultirowfeaturedisplay/#slot-legend) slot.

Most of any segmentation is quiescent or heterochromatic. The track menu's
**Categories** submenu has a checkbox per legend entry: unchecking the quiescent
and repressed states drops them everywhere in the painting, leaving only
promoters, enhancers, and transcription. It applies at render time with no
refetch, and because entries are keyed by color, one uncheck hides every state
sharing that color.

Two more track-menu actions turn the painting into a comparison:

- **Clustering → Cluster rows by similarity** reorders the rows by their state
  colors across the region in view and draws the dendrogram in the sidebar. On
  the 127-epigenome track below, related tissues group themselves at whatever
  locus is in view.
- Right-click a column of the painting and pick **Sort rows by color here** to
  rank the rows by the state each one carries at that base. On a promoter, the
  cell types with an active TSS rise to the top.

## Scaling up: 127 epigenomes

The same recipe scales to the
[Roadmap Epigenomics](https://egg2.wustl.edu/roadmap/web_portal/chr_state_learning.html)
15-state model across 127 epigenomes. The only difference upstream is 127 input
files. The multi-row display fetches and lays out one file, so 127 epigenomes is
one track, one adapter, one fetch.

This track fills in the `legend` slot: the Roadmap file's state names are
mnemonics (`12_EnhBiv`, `14_ReprPCWk`), and fifteen `{label, color}` entries
spell them out and fix their order at 1 to 15. The merged 127-epigenome file is
hosted, so the whole track is:

```json
{
  "type": "FeatureTrack",
  "trackId": "roadmap_chromhmm_multirow_hg19",
  "name": "ChromHMM chromatin state (Roadmap, 127 epigenomes)",
  "assemblyNames": ["hg19"],
  "category": ["Roadmap Epigenomics", "Chromatin state"],
  "adapter": {
    "type": "BigBedAdapter",
    "uri": "https://jbrowse.org/demos/chromhmm/roadmap_15state_127epigenomes.bb"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "cellType",
      "legend": [
        { "label": "1 Active TSS", "color": "rgb(255,0,0)" },
        { "label": "2 Flanking active TSS", "color": "rgb(255,69,0)" },
        { "label": "3 Transcribed 5'/3' flank", "color": "rgb(50,205,50)" },
        { "label": "4 Strong transcription", "color": "rgb(0,128,0)" },
        { "label": "5 Weak transcription", "color": "rgb(0,100,0)" },
        { "label": "6 Genic enhancer", "color": "rgb(194,225,5)" },
        { "label": "7 Enhancer", "color": "rgb(255,255,0)" },
        { "label": "8 ZNF genes / repeats", "color": "rgb(102,205,170)" },
        { "label": "9 Heterochromatin", "color": "rgb(138,145,208)" },
        { "label": "10 Bivalent TSS", "color": "rgb(205,92,92)" },
        { "label": "11 Flanking bivalent", "color": "rgb(233,150,122)" },
        { "label": "12 Bivalent enhancer", "color": "rgb(189,183,107)" },
        { "label": "13 Repressed Polycomb", "color": "rgb(128,128,128)" },
        { "label": "14 Weak repressed Polycomb", "color": "rgb(192,192,192)" },
        { "label": "15 Quiescent / low", "color": "rgb(255,255,255)" }
      ],
      "height": 700
    }
  ]
}
```

Those colors are how the painting reads: red active TSS, yellow enhancer and
green transcription, grey Polycomb, speckled olive where the same bases are
bivalent.

<Figure src="/img/chromhmm.png" caption="127 Roadmap epigenomes over HOXA, one row each, ordered by Cluster rows by similarity. One block of epigenomes opens the cluster; the rest hold it repressed. The stripe left of the painting is each row's Roadmap tissue group."/>

<Video src="/media/epigenomics/chromhmm_cluster.mp4" caption="Clustering the 127-epigenome ChromHMM track over HOXA. The rows open in Roadmap's tissue order; the track menu's Cluster rows by similarity re-lays them out into blocks and draws the dendrogram beside them." />

That config has no `rowOrder`; **Cluster rows by similarity** derives the row
order from the data at whatever locus is in view.

At this scale a row is a few pixels tall and carries no text, so the tissue
names live in the stripe beside the painting. The
[`rowGroups`](/docs/config/linearmultirowfeaturedisplay/#slot-rowgroups) slot
takes one `{ match, group, color }` per Roadmap tissue group and tints each
matching row's sidebar swatch. The build script writes those entries from the
`GROUP` and `COLOR` columns of `EID_metadata.tab`, and the tissue is an axis the
clustering never saw. The key beside the painting lists the groups in the order
the stripe runs, so an entry can be found by where its colour sits.

**ENCODE2012 is a group in that list.** Roadmap folded the ENCODE 2012 reference
epigenomes into the compendium under a group of their own (GM12878, K562,
HeLa-S3, HepG2, A549, HUVEC, NHEK and the rest), so that entry names where the
data came from. It is the largest group, and its members span ten anatomies,
from blood to skin to lung, so the stripe reads as mixed where that colour
appears. The other candidate columns in the same file are `ANATOMY`, which
splits 127 epigenomes across 30 values with eight singletons, and `TYPE`, which
sorts them by how the sample was collected.

## Reproduce it end to end

One script does the whole path,
[`build_chromhmm_multirow.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_chromhmm_multirow.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_chromhmm_multirow.sh
bash build_chromhmm_multirow.sh         # builds ./chromhmm_build/jbrowse2
npx --yes serve chromhmm_build/jbrowse2 # then open the printed URL
```

It downloads the nine segmentation BEDs, merges them into the `cellType`-tagged
BED above, bgzips and tabixes it, downloads JBrowse, and writes the
`config.json` from the section above, opening on the HOXA cluster.

[`build_chromhmm_roadmap.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_chromhmm_roadmap.sh)
builds the 127-epigenome track by the same steps, and ends in the same `bgzip`
plus `tabix -p bed`:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_chromhmm_roadmap.sh
EIDS=E003,E116,E123,E127 bash build_chromhmm_roadmap.sh
npx --yes serve chromhmm_roadmap_build/jbrowse2
```

`EIDS` picks a subset, here the four Roadmap re-analyses of the ENCODE lines the
first track uses, which finishes in minutes. Leave it out for all 127 and the
run takes about twenty minutes and wants ~12 GB of scratch. Every table it needs
is one Roadmap publishes: the row labels come from `EID_metadata.tab`, the row
order from that file's `GROUP` and `EID` columns, and the state colors from
`colormap_15_coreMarks.tab`, since the segmentations themselves are BED4 and
carry no color at all.

## See also

- [](/docs/tutorials/tcga_cohort_cnv)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/scatac_pseudobulk)
- [](/docs/user_guides/clustering)
- [](/docs/config_guides/tracks)

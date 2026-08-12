---
title: ChromHMM chromatin states
description: Paint many-cell-type ChromHMM states in one multi-row track
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
data: download
---

**TL;DR:** merge many per-cell-type ChromHMM segmentation BEDs into one file
with a `cellType` column, then a `LinearMultiRowFeatureDisplay` partitions it
into one color-coded row per cell type from a single track, adapter, and fetch.

## Prerequisites

- `wget` and htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)
- `python3`, for the [127-epigenome build](#reproduce-it-end-to-end) only

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

HOXA is the window the build script opens on because the painting there has a
structure to find rather than just a lot of color. The genes are transcribed in
the order they sit in, so a cell type opens the stretch matching its own
position along the body axis and holds the rest under Polycomb. Most of the rows
that open the cluster at all stop between HOXA7 and HOXA9, which is what makes
the change read as a column across the rows rather than as nine unrelated
patterns.

Which rows those are is why nine cell types are loaded rather than one. The
posterior genes carry a trunk-and-limb address, and the two cell types that open
them are the endothelial and skeletal-muscle lines, HUVEC and HSMM, the
mesodermal pair. The keratinocyte, lung-fibroblast and mammary lines stop at
HOXA7. GM12878 and K562 are blood, and hold the whole cluster shut. H1-hESC is
pluripotent and has no address yet, so it is neither: its magenta is
`3_Poised_Promoter`, an active promoter mark sitting on a repressed cluster,
which is the bivalent state HOX clusters are held in before a lineage commits.

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

And that `#`-prefixed defline is part of the file, so the adapter takes the
column names from the data rather than from the config. `tabix -p bed` keeps `#`
lines as the header, and the script writes the defline outside the coordinate
sort so it stays first.

The merged output is coordinate-sorted, so indexing it is just `bgzip` plus
`tabix -p bed`: JBrowse fetches any region on demand, with no bigBed conversion,
no autoSql schema, and no chrom.sizes file. To skip the build entirely, the
finished 9-cell-type file is also hosted as a bigBed at
`https://jbrowse.org/demos/chromhmm/wgEncodeBroadHmm.multirow.bb`, which carries
the same column names in its embedded autoSql: swap the adapter below for a
[`BigBedAdapter`](/docs/config/bigbedadapter) pointed at that URL and the rest
of the track is unchanged.

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

These steps work unchanged on [JBrowse Desktop](/docs/quickstart_desktop), which
opens `wgEncodeBroadHmm.multirow.bed.gz` straight from local disk with no web
server; point `uri` at the local path.

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
  colors across the region in view and draws the dendrogram in the sidebar. It
  earns its keep on the 127-epigenome track below, where related tissues group
  themselves at whatever locus you're looking at rather than sitting in a
  hand-written order.
- Right-click a column of the painting and pick **Sort rows by color here** to
  rank the rows by the state each one carries at that base. On a promoter, the
  cell types with an active TSS rise to the top.

## Scaling up: 127 epigenomes

The same recipe scales to the
[Roadmap Epigenomics](https://egg2.wustl.edu/roadmap/web_portal/chr_state_learning.html)
15-state model across 127 epigenomes. The only difference upstream is 127 input
files. Because the multi-row display fetches and lays out one file, 127
epigenomes is still one track, one adapter, one fetch, not 127 tracks.

This track also fills in the `legend` slot, because the Roadmap file's state
names are mnemonics (`12_EnhBiv`, `14_ReprPCWk`) and the auto-derived key would
show them as they are. Fifteen `{label, color}` entries spell them out and fix
their order at 1 to 15 rather than by how much of each is on screen. The merged
127-epigenome file is hosted, so the whole track is:

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

Those colors are what the two blocks below are read by: red active TSS, yellow
enhancer and green transcription in the upper one, grey Polycomb in the lower,
speckled olive where the same bases are bivalent.

<Figure src="/img/chromhmm.png" caption="127 Roadmap epigenomes over HOXA, one row each, ordered by Cluster rows by similarity. One block of epigenomes opens the cluster; the rest hold it repressed. The stripe left of the painting is each row's Roadmap tissue group."/>

That config has no `rowOrder`, which is the other thing that changes at this
scale. It would be 127 lines whose only job is to keep related tissues adjacent,
and **Cluster rows by similarity** derives that from the data at whatever locus
is in view. Leave it out and cluster instead when the grouping you want depends
on the locus rather than on a fixed publication order.

Clustering costs the tissue names, though, and that is what the stripe in the
figure above buys back. At this scale a row is a few pixels tall and carries no
text, so the only thing that can say which epigenome it is, is a color. The
[`rowGroups`](/docs/config/linearmultirowfeaturedisplay/#slot-rowgroups) slot
takes one `{ match, group, color }` per Roadmap tissue group, tints each
matching row's sidebar swatch and keys it beside the state colors. The build
script writes those entries from the `GROUP` and `COLOR` columns of the same
`EID_metadata.tab` the labels come from, so nothing about the assignment is
hand-made. The tissue is an axis the clustering never saw, so where the stripe
and the blocks agree it is the data saying so and not the ordering.

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

127 epigenomes is 5.25 GB of merged text and still does not need a bigBed. The
tabix index covers genomic bins rather than records, so stacking 127 rows into
the same coordinates barely grows it, and the compressed file lands smaller than
a bigBed of the same records while building in a fraction of the time. What a
bigBed buys is bytes per view, and mostly when zoomed in: about a tenth as many
at 20 kb, about half at the megabase scale this track is read at, against a
somewhat larger file and a second binary to install. The hosted copy above is a
bigBed holding those same records, so either format loads the track with nothing
else in it changing.

## See also

- [](/docs/tutorials/tcga_cohort_cnv)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/scatac_pseudobulk)
- [](/docs/user_guides/clustering)
- [Configuring tracks](/docs/config_guides/tracks)

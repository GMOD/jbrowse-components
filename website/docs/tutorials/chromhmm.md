---
title: ChromHMM chromatin states
description:
  Painting many-cell-type ChromHMM segmentations in one track with the multi-row
  feature display
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

[ChromHMM](https://compbio.mit.edu/ChromHMM/) segments the genome into chromatin
states (active promoter, strong enhancer, heterochromatin, …) from combinations
of histone-mark ChIP-seq. A segmentation is produced _per cell type_, so a
useful browser track stacks many cell types on top of each other at the same
locus — one labeled row per cell type, each painted with the ChromHMM state
colors.

This tutorial shows how the gallery's ChromHMM figure is built: how to pack many
per-cell-type segmentation BEDs into a single **multi-row BED**, and how to
configure the **multi-row feature display** so the file draws as one color-coded
row per cell type.

<Figure src="/img/chromhmm.png" caption="The multi-row feature display showing dense ChromHMM chromatin-state annotations from ENCODE. Each row is a cell type, and each feature is colored by its chromatin state via the BED itemRgb field. The white regions aren't gaps — Quiescent/Low, the most common state genome-wide, is white in the standard 15-state palette (the same convention UCSC and other browsers use)."/>

## The idea: one file, one row per cell type

ChromHMM's per-cell-type output is a stack of separate BED files (`Gm12878.bed`,
`K562.bed`, …), each a BED9 whose `name` column is the state (e.g.
`1_Active_Promoter`) and whose `itemRgb` column carries the ENCODE state color.
Adding one JBrowse track per cell type is impractical at 9 cell types and worse
at 127. Instead, we merge them into a single file that carries an extra
`cellType` column, then let the **multi-row feature display** split that one
track back into a labeled sub-row per cell type. All rows share one config, one
adapter, and one fetch.

## Combine the per-cell-type BEDs

Start from the UCSC ENCODE Broad HMM 15-state model (hg19) across 9 cell types.
The per-cell-type files live under the
[wgEncodeBroadHmm](http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm/)
download directory. Grab the nine state BEDs:

```bash
wget -r -np -nd -A 'wgEncodeBroadHmm*HMM.bed.gz' \
  http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm/
```

Then concatenate them, appending a `cellType` column derived from each filename
(the `declare -A` associative array needs bash 4+):

```bash
# map each UCSC filename token to its canonical ENCODE cell-line label
declare -A ct=(
  [Gm12878]=GM12878 [H1hesc]=H1-hESC [K562]=K562  [Hepg2]=HepG2 [Huvec]=HUVEC
  [Hmec]=HMEC       [Hsmm]=HSMM      [Nhek]=NHEK   [Nhlf]=NHLF
)
for f in wgEncodeBroadHmm*HMM.bed.gz; do
  tok=$(echo "$f" | sed -E 's/wgEncodeBroadHmm(.*)HMM.bed.gz/\1/')
  zcat "$f" | awk -v c="${ct[$tok]}" 'BEGIN{OFS="\t"} {print $0, c}'
done | sort -k1,1 -k2,2n > wgEncodeBroadHmm.multirow.bed
```

Each line is now standard BED9 plus one trailing string field — the cell-type
label that becomes a row. Those labels are what `rowOrder` references below.

## Compress and index

The combine step already emitted a coordinate-sorted BED, so just bgzip and
tabix it. JBrowse fetches any region on demand — no bigBed conversion, no
autoSql schema, and no chrom.sizes file needed:

```bash
bgzip wgEncodeBroadHmm.multirow.bed
tabix -p bed wgEncodeBroadHmm.multirow.bed.gz
```

## Configure the multi-row feature display

Add a `FeatureTrack` with a `BedTabixAdapter`, and give it a
`LinearMultiRowFeatureDisplay` that partitions on the `cellType` field. The
adapter's `columnNames` names each BED column so the display can resolve column
9 `itemRgb` (the state color) and the extra column 10 `cellType` (the field to
split rows on). The track references the `hg19` assembly — set it up first if
you haven't, see the
[assemblies configuration guide](/docs/config_guides/assemblies):

```json
{
  "type": "FeatureTrack",
  "trackId": "broad_chromhmm_multirow_hg19",
  "name": "ChromHMM chromatin state (Broad ENCODE, 9 cell types)",
  "assemblyNames": ["hg19"],
  "category": ["ENCODE", "Chromatin state"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "columnNames": [
      "chrom",
      "chromStart",
      "chromEnd",
      "name",
      "score",
      "strand",
      "thickStart",
      "thickEnd",
      "itemRgb",
      "cellType"
    ],
    "bedGzLocation": {
      "uri": "wgEncodeBroadHmm.multirow.bed.gz",
      "locationType": "UriLocation"
    }
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "broad_chromhmm_multirow_hg19-LinearMultiRowFeatureDisplay",
      "partitionField": "cellType",
      "color": "jexl:'rgb('+get(feature,'itemRgb')+')'",
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

The fields that drive the display:

- **`columnNames`** (on the adapter) — names each column of the BED, so the
  standard `itemRgb` and the extra `cellType` field resolve as feature
  attributes the display below reads.
- **`partitionField`** — the feature attribute to split rows by. Every distinct
  `cellType` value becomes its own labeled sub-row, so a 9-cell-type file draws
  as 9 stacked rows.
- **`color`** — a [jexl](/docs/config_guides/jexl) callback. Here it turns the
  BED `itemRgb` triple (e.g. `255,0,0`) into a CSS `rgb(255,0,0)`, so each
  feature is painted with its ChromHMM state color straight from the file.
- **`rowOrder`** — pins the sub-rows to a chosen order. Omit it and rows fall
  back to the order the partition values are first seen.

**Using JBrowse Desktop?** These steps work unchanged — Desktop opens
`wgEncodeBroadHmm.multirow.bed.gz` straight from your local disk (point
`bedGzLocation` at the local path), no web server needed. See the
[desktop quickstart](/docs/quickstart_desktop). (A bigBed loaded with a
`BigBedAdapter` works too, and is what the hosted demo below uses; the
tabix-indexed BED just skips the conversion and chrom.sizes step.)

## Scaling up: 127 epigenomes

The same recipe scales to the
[Roadmap Epigenomics](https://egg2.wustl.edu/roadmap/web_portal/chr_state_learning.html)
15-state model across 127 epigenomes — the only difference is 127 input BEDs and
a longer `rowOrder`. Because the multi-row display fetches and lays out one
file, 127 cell types is the same one track, not 127 tracks. This is the second
ChromHMM track in the JBrowse demo config.

You can open both tracks live in the
[JBrowse demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json)
under the **ENCODE → Chromatin state** and **Roadmap Epigenomics → Chromatin
state** categories.

## See also

- [Phased trio analysis](/docs/tutorials/analyze_trio) — another multi-row
  feature display use case, painting hap-ibd inheritance blocks
- [Single-cell ATAC pseudobulk tracks](/docs/tutorials/scatac_pseudobulk) — the
  continuous-signal analog of this one-row-per-group pattern, using MultiWiggle
  instead of discrete features
- [jexl](/docs/config_guides/jexl) — the color callback syntax used to map
  itemRgb to a CSS color
- [Configuring tracks](/docs/config_guides/tracks) — general
  FeatureTrack/BedTabixAdapter config referenced above

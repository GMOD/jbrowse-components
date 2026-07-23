---
title: ChromHMM chromatin states
description: Paint many-cell-type ChromHMM states in one multi-row track
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

[ChromHMM](https://compbio.mit.edu/ChromHMM/) segments the genome into chromatin
states (active promoter, strong enhancer, heterochromatin, …) from combinations
of histone-mark ChIP-seq. A segmentation is produced _per cell type_, so a
useful browser track stacks many cell types on top of each other at the same
locus, one labeled row per cell type, each painted with the ChromHMM state
colors.

This tutorial shows how the gallery's ChromHMM figure is built: how to pack many
per-cell-type segmentation BEDs into a single multi-row BED, and how to
configure the multi-row feature display so the file draws as one color-coded row
per cell type.

Building the colored-interval BED is the DataFrame-to-track pattern shown in the
[JBrowse Jupyter / anywidget interface](/docs/jbrowse_jupyter) (or
[JBrowseR](/docs/jbrowser) in R), so you can build and view it in one session
with no file written.

<Figure src="/img/chromhmm.png" caption="The multi-row feature display showing dense ChromHMM chromatin-state annotations from ENCODE. Each row is a cell type, each feature colored by its chromatin state via the BED itemRgb field. White regions are the Quiescent/Low state, which is white in the standard 15-state palette."/>

## What you need

- `bash` 4+ (for the `declare -A` map)
- `wget` and htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install wget tabix` covers `wget` and htslib; `node`
comes from [nodejs.org](https://nodejs.org/).

## The idea: one file, one row per cell type

ChromHMM's per-cell-type output is a stack of separate BED files (`Gm12878.bed`,
`K562.bed`, …). Each is a BED9 whose `name` column holds the state (e.g.
`1_Active_Promoter`) and whose `itemRgb` column carries the ENCODE state color.
Adding one JBrowse track per cell type is impractical at 9 cell types and worse
at 127. So instead we merge them into a single file with an extra `cellType`
column, then let the multi-row feature display split that one track back into a
labeled sub-row per cell type. Every row shares one config, one adapter, and one
fetch.

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

Each line is now standard BED9 plus one trailing string field, the cell-type
label that becomes a row. Those labels are what `rowOrder` references below.

## Compress and index

The combine step already emitted a coordinate-sorted BED, so just bgzip and
tabix it. JBrowse fetches any region on demand, with no bigBed conversion, no
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
split rows on). The track references the `hg19` assembly. Set it up first if you
haven't, see the
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

- `columnNames` (on the adapter) - names each column of the BED, so the standard
  `itemRgb` and the extra `cellType` field resolve as feature attributes the
  display below reads.
- `partitionField` - the feature attribute to split rows by. Every distinct
  `cellType` value becomes its own labeled sub-row, so a 9-cell-type file draws
  as 9 stacked rows.
- `rowOrder` - pins the sub-rows to a chosen order. Omit it and rows fall back
  to the order the partition values are first seen.

Note there's no color setting: a BED carrying `itemRgb` is painted with it
automatically, so each feature gets its ChromHMM state color straight from the
file. Set the [`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color)
slot only to override that.

**Using JBrowse Desktop?** These steps work unchanged. Desktop opens
`wgEncodeBroadHmm.multirow.bed.gz` straight from your local disk (point
`bedGzLocation` at the local path), no web server needed. See the
[desktop quickstart](/docs/quickstart_desktop). (A bigBed loaded with a
`BigBedAdapter` works too, and is what the hosted demo below uses, while the
tabix-indexed BED just skips the conversion and chrom.sizes step.)

## Scaling up: 127 epigenomes

The same recipe scales to the
[Roadmap Epigenomics](https://egg2.wustl.edu/roadmap/web_portal/chr_state_learning.html)
15-state model across 127 epigenomes. The only difference is 127 input BEDs and
a longer `rowOrder`. Because the multi-row display fetches and lays out one
file, 127 cell types is the same one track, not 127 tracks. This is the second
ChromHMM track in the JBrowse demo config.

You can open both tracks live in the
[JBrowse demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json)
under the **ENCODE → Chromatin state** and **Roadmap Epigenomics → Chromatin
state** categories.

## Reproduce it end to end

Every step above is wrapped in one script,
[`build_chromhmm_multirow.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_chromhmm_multirow.sh):

```bash
bash scripts/build_chromhmm_multirow.sh   # builds ./chromhmm_build/jbrowse2
npx --yes serve chromhmm_build/jbrowse2   # then open the printed URL
```

It downloads the nine ENCODE Broad HMM segmentation BEDs, merges them into the
single `cellType`-tagged BED, bgzips and tabixes it, downloads JBrowse, and
writes a `config.json` with the hg19 assembly and the multi-row ChromHMM track
described above, opening on the HOXA cluster. It requires:

- `bash` 4+ (for the `declare -A` map)
- `wget`
- htslib (`bgzip`, `tabix`)
- `node`

On Debian/Ubuntu, `apt install wget tabix` covers `wget` and htslib
(`bgzip`/`tabix`); `node` comes from [nodejs.org](https://nodejs.org/).

## See also

- [Phased trio analysis](/docs/tutorials/analyze_trio)
- [Single-cell ATAC pseudobulk](/docs/tutorials/scatac_pseudobulk)
- [jexl](/docs/config_guides/jexl)
- [Configuring tracks](/docs/config_guides/tracks)

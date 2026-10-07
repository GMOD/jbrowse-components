---
title: ChromHMM chromatin states
description: Paint many-cell-type ChromHMM states in one multi-row track
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

ChromHMM labels each region of the genome with a chromatin state, promoter,
enhancer, heterochromatin and so on, once per cell type. We merge many
per-cell-type segmentation BEDs into one file, which JBrowse draws as a single
track with one color-coded row per cell type. We read it at two loci: the _HOXA_
cluster, where each cell type opens the genes matching its place along the body
axis, and _PAX5_, a B-cell gene with genic enhancers only in B cells.

## Prerequisites

- `wget`
- htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)
- `python3`, for the [127-epigenome build](#reproduce-it-end-to-end) only
- `jq`, for the Roadmap tissue groups only

On Debian/Ubuntu, `apt install wget tabix` covers `wget` and htslib; `node`
comes from [nodejs.org](https://nodejs.org/).

## Where the data comes from

Two hg19 ChromHMM releases, both 15-state segmentations: UCSC's nine-cell-type
ENCODE Broad HMM set, and the Roadmap Epigenomics compendium across 127
epigenomes.

The [build scripts](#reproduce-it-end-to-end) fetch these files, so there is
nothing to download by hand.

- the nine ENCODE Broad HMM segmentation BEDs, one per cell type, merged into
  the multi-row file below:
  http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm/
- the Roadmap segmentations, fetched either individually or as the whole
  127-epigenome tarball:
  https://egg2.wustl.edu/roadmap/data/byFileType/chromhmmSegmentations/ChmmModels/coreMarks/jointModel/final/
- the row labels, tissue groups and tissue colors, `EID_metadata.tab`:
  https://egg2.wustl.edu/roadmap/data/byFileType/metadata/EID_metadata.tab
- the state colors, since the Roadmap segmentations themselves have none:
  https://egg2.wustl.edu/roadmap/data/byFileType/chromhmmSegmentations/ChmmModels/coreMarks/jointModel/final/colormap_15_coreMarks.tab

<details>
<summary>Read by URL (no download needed)</summary>

- both merged files, rehosted as bigBeds so the tracks below load without the
  build: https://jbrowse.org/demos/chromhmm/wgEncodeBroadHmm.multirow.bb and
  https://jbrowse.org/demos/chromhmm/roadmap_15state_127epigenomes.bb

</details>

## Many cell types in one track

[ChromHMM](https://compbio.mit.edu/ChromHMM/) segments the genome into chromatin
states (active promoter, strong enhancer, heterochromatin, ...) from
combinations of histone-mark ChIP-seq, one segmentation per cell type. Its
output is a stack of BED9 files (`Gm12878.bed`, `K562.bed`, ...) whose `name`
column holds the state (e.g. `1_Active_Promoter`) and whose `itemRgb` column
holds the state color. Merging them into one file with an extra `cellType`
column lets the multi-row feature display draw a labeled sub-row per cell type,
so 9 cell types (or 127) share one config, one adapter, and one fetch.

## Merging nine ENCODE segmentation BEDs into one file

The nine
[UCSC ENCODE Broad HMM](http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm/)
15-state segmentation BEDs concatenate into one `cellType`-tagged BED. Each line
is BED9 plus one trailing field, the cell-type label that becomes a row:

```text
#chrom  chromStart  chromEnd  name               score  strand  thickStart  thickEnd  itemRgb      cellType
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  GM12878
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  K562
```

The `#`-prefixed defline is part of the file, so the adapter takes the column
names from it. The merge is one pass:

<!-- from: scripts/build_chromhmm_multirow.sh -->

```bash
# awk appends each file's name as the row label, so Gm12878.bed.gz labels
# its segments Gm12878
{
  printf '#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\tcellType\n'
  for f in *.bed.gz; do
    gzip -dc "$f" | awk -v c="${f%%.*}" 'BEGIN{OFS="\t"} {print $0, c}'
  done
} > multirow.bed

# `sort-bed` is `sort -k1,1 -k2,2n` with the #-defline kept on top, and pins
# LC_ALL=C so nine files' worth of refnames group the same way everywhere
jbrowse sort-bed multirow.bed | bgzip > multirow.bed.gz
tabix -p bed multirow.bed.gz
```

The merged ENCODE and Roadmap files are also hosted as bigBeds (see
[Where the data comes from](#where-the-data-comes-from)), which a
[`BigBedAdapter`](/docs/config/bigbedadapter) reads, as in the Roadmap track
config below.

## Configuring a multi-row display, one row per cell type

Both releases are on hg19, so we load that assembly and a RefSeq gene track for
the figures to sit under:

```json addassembly
{
  "name": "hg19",
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/bigZips/hg19.2bit",
  "refNameAliases": {
    "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/bigZips/hg19.chromAlias.txt"
  }
}
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ncbi_gff_hg19",
  "name": "NCBI RefSeq genes",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz"
  }
}
```

The track config below opens the merged file in a multi-row feature display
partitioned on `cellType`. For your own segmentations, swap `uri` for the
bgzipped, tabix-indexed BED from the merge above:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "broad_chromhmm_multirow_hg19",
  "name": "ChromHMM chromatin state (Broad ENCODE, 9 cell types)",
  "uri": "wgEncodeBroadHmm.multirow.bed.gz",
  "assemblyNames": ["hg19"],
  "category": ["ENCODE", "Chromatin state"],
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": {
        "field": "cellType",
        "domain": [
          "GM12878",
          "H1-hESC",
          "K562",
          "HepG2",
          "HUVEC",
          "HMEC",
          "HSMM",
          "NHEK",
          "NHLF"
        ]
      },
      "height": 200
    }
  ]
}
```

JBrowse finds the `.bed.gz.tbi` beside the file.
[`rows`](/docs/config/linearmultirowfeaturedisplay/#slot-rows) sets up the
sub-rows:

- `field` is the attribute to split rows by; every distinct `cellType` becomes a
  labeled sub-row
- `domain` pins the sub-rows to an order, here ENCODE's tiers; the default is
  alphabetical

[`rowHeight`](/docs/config/linearmultirowfeaturedisplay/#slot-rowheight) stays
at its auto-fit default, dividing the track height across the rows.

JBrowse paints each feature with its `itemRgb`. The
[`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color) slot overrides
that, taking the same `field` and `domain` pair as `rows`. The adapter needs
[`columnNames`](/docs/config/bedtabixadapter/#slot-columnnames) only for a file
without a defline.

Type `chr7:27,110,000-27,265,000` into the location box, the _HOXA_ cluster and
the window the build script opens on:

<Figure src="/img/chromhmm_encode_hoxa.png" caption="The nine ENCODE cell types over HOXA, one row each in ENCODE's tier order, under the RefSeq genes. HUVEC, HSMM and NHEK are active into the posterior genes, NHLF stops at HOXA7 and HMEC fades past it, the blood lines GM12878 and K562 are repressed across the cluster, and H1-hESC is poised." />

The HOX genes are transcribed in the order they sit in, so each cell type opens
the stretch matching its position along the body axis and holds the rest under
Polycomb, a repressive chromatin complex. HUVEC and HSMM, the mesodermal pair,
open the posterior genes, and the keratinocyte line opens them through _HOXA10_;
the lung-fibroblast line stops at _HOXA7_ and the mammary line fades past it;
GM12878 and K562 are blood and keep the whole cluster repressed. H1-hESC's
magenta is `3_Poised_Promoter`, the bivalent state HOX clusters are held in
before a lineage commits.

## Chromatin-state legend, filtering and row order {#the-legend-filtering-and-row-order}

JBrowse builds the key from the state colors, one entry per distinct color,
labeled with the first state name seen in it. States sharing a color collapse
into one entry; in the Broad 15-state model that pairs `4_Strong_Enhancer` with
`5_`, `6_Weak_Enhancer` with `7_`, `9_Txn_Transition` with `10_Txn_Elongation`,
and `13_Heterochrom/lo` with both `Repetitive/CNV` states. Turn the key off with
**Show... → Show legend** in the track menu, or name the colors yourself with an
identity [`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color) scale,
which keeps the file's colors and relabels them in the key.

Most of any segmentation is quiescent or heterochromatic. The track menu's
**Categories** submenu has a checkbox per legend entry; unchecking the quiescent
and repressed states leaves only promoters, enhancers and transcription. JBrowse
applies the filter while drawing, with no refetch.

Two more track-menu actions compare the rows:

- **Clustering → Cluster rows by similarity...** reorders the rows by the state
  each has across the region in view and draws the dendrogram in the sidebar
- Right-click a column and pick **Sort rows by color here** to rank the rows by
  the state each has at that base

## Roadmap's 127 epigenomes at PAX5 and HOXA

Merging the
[Roadmap Epigenomics](https://egg2.wustl.edu/roadmap/web_portal/chr_state_learning.html)
15-state segmentations of 127 epigenomes with the `cellType`-tagged merge above
turns 127 input files into one track and one fetch.

The Roadmap state names are mnemonics (`12_EnhBiv`, `14_ReprPCWk`), so this
track labels its colors with `scale: "identity"`. The `itemRgb` in the file
still paints each block, and `labels` spells out the fifteen `domain` colors in
order. The merged file is hosted, so the track below loads as it stands. It
omits three settings the PAX5 figure uses to order and tint the 127 rows,
because their lists run to hundreds of lines: a `rows.domain` naming every
epigenome in the paper's tissue order, and the `rowGroups` and `rowColor` built
later in this section. The hosted demo config,
https://jbrowse.org/code/jb2/main/test_data/config_demo.json, has the track with
all three:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "roadmap_chromhmm_multirow_hg19",
  "name": "ChromHMM chromatin state (Roadmap, 127 epigenomes)",
  "uri": "https://jbrowse.org/demos/chromhmm/roadmap_15state_127epigenomes.bb",
  "assemblyNames": ["hg19"],
  "category": ["Roadmap Epigenomics", "Chromatin state"],
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": "cellType",
      "color": {
        "scale": "identity",
        "domain": [
          "rgb(255,0,0)",
          "rgb(255,69,0)",
          "rgb(50,205,50)",
          "rgb(0,128,0)",
          "rgb(0,100,0)",
          "rgb(194,225,5)",
          "rgb(255,255,0)",
          "rgb(102,205,170)",
          "rgb(138,145,208)",
          "rgb(205,92,92)",
          "rgb(233,150,122)",
          "rgb(189,183,107)",
          "rgb(128,128,128)",
          "rgb(192,192,192)",
          "rgb(255,255,255)"
        ],
        "labels": [
          "1 Active TSS",
          "2 Flanking active TSS",
          "3 Transcribed 5'/3' flank",
          "4 Strong transcription",
          "5 Weak transcription",
          "6 Genic enhancer",
          "7 Enhancer",
          "8 ZNF genes / repeats",
          "9 Heterochromatin",
          "10 Bivalent TSS",
          "11 Flanking bivalent",
          "12 Bivalent enhancer",
          "13 Repressed Polycomb",
          "14 Weak repressed Polycomb",
          "15 Quiescent / low"
        ]
      },
      "height": 700
    }
  ]
}
```

Red is active TSS, yellow enhancer, green transcription, grey Polycomb, and
speckled olive bivalent.

Type `chr9:34,700,000-38,420,000` into the location box, the chr9 stretch from
_FAM205A_ to _ALDH1B1_. With the hosted track's tissue order, the track
reproduces [Roadmap Epigenomics 2015](https://doi.org/10.1038/nature14248) Fig.
3a, all 127 epigenomes in the paper's order. Promoters stay red through nearly
every row. Over PAX5, strong transcription with genic enhancers (green and
yellow) marks only the B cells and the B-lymphoblastoid GM12878. Spleen and
blood mononuclear cells, which hold B cells, and a few ES, iPS and neural
progenitor lines show PAX5 transcribed without the enhancers.

<Figure src="/img/chromhmm.png" caption="All 127 Roadmap epigenomes over chr9 from FAM205A to ALDH1B1, rows in the paper's tissue order and banded by tissue group with facet, each label tinted by its group. Promoters are red in every tissue; PAX5 (boxed) is transcribed with genic enhancers only in the B cell rows and GM12878."/>

Listing six epigenome names in `rows.domain` and `rows.kept` narrows the same
track to lung fibroblasts, foreskin fibroblasts and ES cells over HOXA, which
reproduces the chromatin domains
[Rinn et al. 2007](https://doi.org/10.1016/j.cell.2007.05.022) mapped in
fibroblasts from different parts of the body:

```json session
{
  "defaultSession": {
    "name": "HOXA fibroblasts",
    "views": [
      {
        "id": "hoxa_lgv",
        "type": "LinearGenomeView",
        "assembly": "hg19",
        "loc": "chr7:27,110,000-27,265,000",
        "tracks": [
          {
            "type": "FeatureTrack",
            "configuration": "roadmap_chromhmm_multirow_hg19",
            "displays": [
              {
                "type": "LinearMultiRowFeatureDisplay",
                "configuration": "roadmap_chromhmm_multirow_hg19-LinearMultiRowFeatureDisplay",
                "rows": {
                  "field": "cellType",
                  "domain": [
                    "NHLF Lung Fibroblast Primary Cells",
                    "IMR90 fetal lung fibroblasts Cell Line",
                    "Foreskin Fibroblast Primary Cells skin01",
                    "Foreskin Fibroblast Primary Cells skin02",
                    "H1 Cells",
                    "H9 Cells"
                  ],
                  "kept": [
                    "NHLF Lung Fibroblast Primary Cells",
                    "IMR90 fetal lung fibroblasts Cell Line",
                    "Foreskin Fibroblast Primary Cells skin01",
                    "Foreskin Fibroblast Primary Cells skin02",
                    "H1 Cells",
                    "H9 Cells"
                  ]
                },
                "height": 240
              }
            ]
          }
        ]
      }
    ]
  }
}
```

<Figure src="/img/chromhmm_hoxa_fibroblasts.png" caption="Lung fibroblasts, foreskin fibroblasts and ES cells over HOXA. Lung fibroblasts keep HOXA1-A7 (red box) active and HOXA9-A13 (blue box) Polycomb-repressed, foreskin fibroblasts the reverse, and ES cells hold the whole cluster repressed."/>

**Clustering → Cluster rows by similarity...** in the track menu replaces the
tissue order with one derived from the data at whatever locus is in view.

<Video src="/media/epigenomics/chromhmm_cluster.mp4" caption="Clustering the 127-epigenome ChromHMM track over HOXA. The rows open in Roadmap's tissue order; the track menu's Cluster rows by similarity re-lays them out into blocks and draws the dendrogram beside them." />

With 127 rows in one track a row is a few pixels tall and its label barely
legible, so three settings group the rows by the 19 Roadmap tissue groups:

- [`rowGroups`](/docs/config/linearmultirowfeaturedisplay/#slot-rowgroups) tags
  each row with a `group`, taking one `{ match, group }` per tissue, where
  `match` is a regex over the row names
- [`facet`](/docs/config/linearmultirowfeaturedisplay/#slot-facet) `"group"`
  stacks the rows in one labelled band per tissue
- [`rowColor`](/docs/config/linearmultirowfeaturedisplay/#slot-rowcolor) with
  `field: "group"` pairs each tissue with a color, drawn as a bar beside each
  row's label

Nineteen hues are too many to tell apart, so a row's band carries its tissue and
the color backs that up. The file's `itemRgb` still paints the blocks their
state colors, so the tissue color lands on the label bar alone. Two of the
nineteen tissues look like this:

```json
{
  "rowGroups": [
    { "match": "^(Adipose Nuclei)$", "group": "Adipose" },
    {
      "match": "^(Aorta|Fetal Heart|Left Ventricle|Right Atrium|Right Ventricle)$",
      "group": "Heart"
    }
  ],
  "facet": "group",
  "rowColor": {
    "field": "group",
    "domain": ["Adipose", "Heart"],
    "range": ["#AF5B39", "#D56F80"]
  }
}
```

The `GROUP` and `COLOR` columns of `EID_metadata.tab` supply both lists. One
`jq` call writes them from the `STD_NAME` column, escaping the regex
metacharacters in the names:

```bash
jq -R -s 'split("\n")[1:-1] | map(split("\t")) | group_by(.[1])
  | { rowGroups: map({ match: ("^(" + (map(.[4] | gsub("(?<c>[.()+*?\\[\\]^$|\\\\{}])"; "\\" + .c)) | join("|")) + ")$"),
                       group: .[0][1] }),
      rowColor: { field: "group", domain: map(.[0][1]), range: map(.[0][2]) } }' EID_metadata.tab > tissues.json
```

Merge the two keys of `tissues.json` into the display. The build script also
appends the mnemonic to a name that two epigenomes share, which a `STD_NAME`
match leaves as one row.

The hosted track leaves `facet` out and orders the rows by tissue through
`rows.domain`, so clustering runs over all 127 together, and the label bars show
which tissues a cluster spans. The PAX5 figure sets `facet` to draw the bands.

The 19 groups in `EID_metadata.tab` include ENCODE2012. Roadmap folded the
ENCODE 2012 reference epigenomes (GM12878, K562, HeLa-S3, HepG2, A549, HUVEC,
NHEK and the rest) into the compendium as one group, so that group names a data
source, and its members span several anatomies. The same file's `ANATOMY` column
splits the epigenomes finer, and `TYPE` sorts them by how the sample was
collected.

## Reproduce it end to end

One script does the whole path,
[`build_chromhmm_multirow.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_chromhmm_multirow.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_chromhmm_multirow.sh
bash build_chromhmm_multirow.sh         # builds ./chromhmm_build/jbrowse2
npx --yes serve chromhmm_build/jbrowse2 # then open the printed URL
```

The script downloads the nine segmentation BEDs, merges, bgzips and tabixes
them, downloads JBrowse, and writes the `config.json` above, opening on HOXA.

[`build_chromhmm_roadmap.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_chromhmm_roadmap.sh)
builds the 127-epigenome track by the same merge. Roadmap's segmentations are
bare BED4, so the script fills in what the ENCODE files had:

1. paints each segment its state's color from `colormap_15_coreMarks.tab`,
   giving the merged file the `itemRgb` column that draws it
2. labels each row with the epigenome's name from `EID_metadata.tab`, adding its
   mnemonic where two epigenomes share a name, so the two never merge into one
   row
3. orders the rows by tissue group, so a tissue's epigenomes sit together under
   one label-bar color

The color join for one epigenome is a single `awk` call. It looks each state's
number, the part of the name before the underscore, up in the colormap and
appends the `itemRgb` and `cellType` columns:

<!-- from: scripts/build_chromhmm_roadmap.sh -->

```bash
awk -F'\t' -v c="NHLF Lung Fibroblast Primary Cells" 'BEGIN { OFS = "\t" }
  NR == FNR { rgb[$1] = $2; next }
  { split($4, s, "_"); print $1, $2, $3, $4, 0, ".", $2, $3, rgb[s[1]], c }' \
  colormap_15_coreMarks.tab E128_15_coreMarks_mnemonics.bed
```

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_chromhmm_roadmap.sh
EIDS=E003,E116,E123,E127 bash build_chromhmm_roadmap.sh
npx --yes serve chromhmm_roadmap_build/jbrowse2
```

`EIDS` picks a subset, here the four Roadmap re-analyses of the ENCODE lines in
the nine-cell-type track. Leave it out for all 127, which takes about twenty
minutes and ~12 GB of scratch.

## See also

- [](/docs/tutorials/tcga_cohort_cnv)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/scatac_pseudobulk)
- [](/docs/tutorials/alu_age)
- [](/docs/tutorials/alphagenome)
- [](/docs/user_guides/clustering)
- [](/docs/config_guides/tracks)
- [](/docs/config_guides/grouping_and_ordering)

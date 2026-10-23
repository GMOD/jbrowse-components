---
title: RepeatMasker as one row per class
sidebar_label: genomes.jbrowse.org (RepeatMasker rows)
description:
  Split a hub's RepeatMasker track into a labelled row per repeat class, without
  preparing any data
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

Repeat classes spread along a genome differently: over a window of 17q21, SINE
copies fill it end to end while LINE copies come in clusters. A RepeatMasker
track draws every class in one packed row of colored blocks, where that
difference is hard to read. We:

- switch hg38's RepeatMasker track to a
  [multi-row feature display](/docs/user_guides/multirow_feature_track), one
  labelled row per class
- pin the row order and colors in a track config
- serve your own RepeatMasker output the same way

JBrowse reads the classes from the file, so no data preparation is needed. Every
genome at [genomes.jbrowse.org](https://genomes.jbrowse.org), and any UCSC or
GenArk hub config, has a RepeatMasker track to try.

## Prerequisites

- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- htslib (`bgzip`, `tabix`), for indexing your own output
- `samtools`, for
  [serving your own RepeatMasker output](#serving-your-own-repeatmasker-output)
  and [Reproduce it end to end](#reproduce-it-end-to-end), which runs the same
  conversion
- `node`, for the [JBrowse CLI](/docs/cli), which both of those need too

<!-- TUTORIAL_INSTALL samtools,htslib,node,jbrowse-cli START -->

```bash
# Debian/Ubuntu
sudo apt install samtools tabix nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools htslib nodejs
# any platform
npm install -g @jbrowse/cli
```

<!-- TUTORIAL_INSTALL samtools,htslib,node,jbrowse-cli END -->

## The data

The figures read UCSC's RepeatMasker track for hg38 and dm6, rehosted on
jbrowse.org.

Nothing to download: the track configs read their files by URL. The
[build script](#reproduce-it-end-to-end) takes a genome of your own, as its
FASTA and RepeatMasker's `.out`.

## Where UCSC and GenArk hubs store the repeat class

The multi-row display's `rows` assigns one row per value of a `field`. UCSC
golden-path and GenArk hubs store the repeat class in different places:

- A **UCSC golden-path** assembly ships a BED whose header names its columns,
  `repClass` among them. That column is a feature attribute, so `rows` is
  `"repClass"`.
- A **GenArk** assembly ships a `bigRmskBed`, whose autoSql has no class column.
  The name contains the class as a suffix, `L1HS#LINE/L1`, so `rows` derives it
  with a jexl expression, `"jexl:split(split(feature.name,'#')[1],'/')[0]"`;
  [](/docs/user_guides/multirow_feature_track#when-the-category-is-not-a-column)
  works through it.

In both cases JBrowse builds the rows from the values in the window, so a window
with no satellite repeats has no satellite row.

## Switching hg38's RepeatMasker track to one row per class

We'll open hg38 on [genomes.jbrowse.org](https://genomes.jbrowse.org) and switch
the track:

- Turn on **RepeatMasker** and type `chr17:45,700,000-45,750,000` into the
  location box.
- **Display types → Multi-row feature display (painting)** in the track menu.

The display partitions on `repClass` whenever the file has that column, and
**One row per...** in the same menu lists every column the loaded features have,
`repFamily` among them. <!-- menu-path-ok -->

<Figure src="/img/multirow/display_types_menu.png" caption="Top: the track menu's Display types submenu on the UCSC RepeatMasker track; any feature track offers the multi-row display beside its default one. Bottom: the same window after picking it, one row per repeat class." />

<Video src="/media/repeats/painting_display_switch.mp4" caption="The RepeatMasker track from one packed row to a labelled row per class: the track menu's Display types, and the multi-row painting partitioning on the repeat class column in the file." />

<Figure caption="Top: RepeatMasker colored by repClass in one packed row. Bottom: the same track with one row per repClass." src="/img/cookbook_color_by_type_two_ways.png"/>

## Pinning row order and colors in a track config

A track config can open the track in the partitioned view, and two settings keep
the rows stable as the window's class list changes. `rows.sort` lists the
classes that come first, in order, and a class it leaves out follows the listed
ones. `rowColor` is a color scale on each row's label bar, pairing each class in
its `domain` with a color in its `range`.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "rmsk_hg38_rows",
  "name": "RepeatMasker by class",
  "uri": "rmsk.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": {
        "field": "repClass",
        "sort": [
          "SINE",
          "LINE",
          "LTR",
          "DNA",
          "Simple_repeat",
          "Low_complexity"
        ]
      },
      "rowColor": {
        "scale": {
          "domain": [
            "SINE",
            "LINE",
            "LTR",
            "DNA",
            "Simple_repeat",
            "Low_complexity"
          ],
          "range": [
            "#e41a1c",
            "#377eb8",
            "#4daf4a",
            "#984ea3",
            "#ff7f00",
            "#a65628"
          ]
        }
      },
      "axis": { "grid": true }
    }
  ]
}
```

A row not named in `rowColor` paints in the default block color. `unknown` in
`rowColor` sets one color for every unnamed row.

The track opens with the first display listed, so the multi-row entry makes rows
the default. A bare `{ "type": "LinearBasicDisplay" }` ahead of it keeps the
packed form as the default and leaves the rows one menu click away.

The rows come from the classes in the file, so a class `rowColor` leaves out
still gets a row, as `Unknown` does in the figures.

## Serving your own RepeatMasker output

A hub's RepeatMasker BED has the `repClass` column the display partitions on.
The RepeatMasker `.out` file instead writes a single `class/family` field,
`LINE/L1` for a repeat with both and a bare `Simple_repeat` for one whose family
is its class. Splitting that field in two, under a header naming the columns,
turns the `.out` into the file the track above reads:

<!-- from: scripts/build_repeatmasker_classes.sh -->

```bash
# the header names the columns, so `rows: "repClass"` can name a column
# outside the BED spec
{
  printf '#genoName\tgenoStart\tgenoEnd\tname\tstrand\trepFamily\trepClass\tswScore\tmilliDiv\n'
  awk 'BEGIN { OFS = "\t" }
    # a data row is the one starting with a bare integer, its SW score
    $1 ~ /^[0-9]+$/ {
      # "LINE/L1" splits; "Simple_repeat" does not, and UCSC repeats the class
      # as the family for exactly those rows. Positions are 1-based inclusive
      # and the strand column spells minus "C".
      n = split($11, cf, "/")
      print $5, $6 - 1, $7, $10, ($9 == "C") ? "-" : "+", (n > 1) ? cf[2] : cf[1], cf[1], $1, int($2 * 10 + 0.5)
    }' repeats.out
} > rmsk.bed

# `sort-bed` is `sort -k1,1 -k2,2n` under LC_ALL=C, header kept on top
jbrowse sort-bed rmsk.bed | bgzip > rmsk.bed.gz
tabix -p bed rmsk.bed.gz
```

## Reproduce it end to end

[`build_repeatmasker_classes.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_repeatmasker_classes.sh)
turns your RepeatMasker `.out` into a runnable JBrowse. The script:

1. Splits the `.out`'s `class/family` field into a class column and a family
   column.
2. Writes a BED whose header names the columns UCSC's does, then bgzips and
   indexes it.
3. Downloads JBrowse and adds the track with the multi-row display selected.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_repeatmasker_classes.sh
bash build_repeatmasker_classes.sh genome.fa repeats.out  # builds ./repeatmasker_build/jbrowse2
npx --yes serve repeatmasker_build/jbrowse2               # then open the printed URL
```

`genome.fa` is the FASTA RepeatMasker was run against and `repeats.out` is its
`.out`; either may be gzipped.

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/cookbook#colors)
- [](/docs/tutorials/chromhmm)

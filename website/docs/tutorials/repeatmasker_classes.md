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
difference is hard to read. The same file opened as a
[multi-row feature display](/docs/user_guides/multirow_feature_track) draws one
labelled row per class.

JBrowse reads the classes from the file, so no data preparation is needed. Every
genome at [genomes.jbrowse.org](https://genomes.jbrowse.org), and any other
UCSC/GenArk hub config, has a RepeatMasker track to try it on.

## Prerequisites

- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- htslib (`bgzip`, `tabix`, `htsfile`), for the check at the end
- `samtools`, for
  [serving your own RepeatMasker output](#serving-your-own-repeatmasker-output)
  and [Reproduce it end to end](#reproduce-it-end-to-end), which runs the same
  conversion
- `node`, for the [JBrowse CLI](/docs/cli), which both of those need too

## Where the data comes from

The figures read UCSC's RepeatMasker track for hg38 and dm6, rehosted on
jbrowse.org.

Nothing to download: the track configs and the commands below read these files
by URL. The [build script](#reproduce-it-end-to-end) takes a genome of your own,
as its FASTA and RepeatMasker's `.out`.

<details>
<summary>The files</summary>

- hg38, read by the tabix command under
  [Checking the rows against the file](#checking-the-rows-against-the-file):
  https://jbrowse.org/ucsc/hg38/rmsk.bed.gz
- dm6, the file the diff under
  [Reproduce it end to end](#reproduce-it-end-to-end) checks a home-built
  conversion against: https://jbrowse.org/ucsc/dm6/rmsk.bed.gz

</details>

## Where UCSC and GenArk hubs store the repeat class

UCSC golden-path and GenArk hubs store the repeat class differently:

- A **UCSC golden-path** assembly ships a BED whose header names its columns,
  `repClass` among them. That column is a feature attribute, so `rows` is
  `"repClass"`.
- A **GenArk** assembly ships a `bigRmskBed`, whose autoSql has no class column.
  The name contains the class as a suffix, `L1HS#LINE/L1`, so `rows` derives it
  with a jexl expression, `"jexl:split(split(feature.name,'#')[1],'/')[0]"`;
  [](/docs/user_guides/multirow_feature_track#when-the-category-is-not-a-column)
  works through it.

In both cases JBrowse builds the rows from the values in the loaded region, so a
window with no satellite repeats has no satellite row.

## Switching hg38's RepeatMasker track to one row per class

Open hg38 on [genomes.jbrowse.org](https://genomes.jbrowse.org), turn on
**RepeatMasker**, type `chr17:45,700,000-45,750,000` into the location box, then
pick **Display types → Multi-row feature display (painting)** in the track menu.
The multi-row display partitions on `repClass` whenever the file has that
column; **One row per...** in the same menu lists every column the loaded
features have, `repFamily` among them. <!-- menu-path-ok -->

<Figure src="/img/multirow/display_types_menu.png" caption="Top: the track menu's Display types submenu on the UCSC RepeatMasker track; any feature track offers the multi-row display beside its default one. Bottom: the same window after picking it, one row per repeat class." />

<Video src="/media/repeats/painting_display_switch.mp4" caption="The RepeatMasker track from one packed row to a labelled row per class: the track menu's Display types, and the multi-row painting partitioning on the repeat class column in the file." />

<Figure caption="Top: UCSC RepeatMasker over a 17q21 window, colored by repClass, every class in one packed row. Bottom: the same track and window with one row per repClass. SINE fills the window and LINE comes in clusters. The empty LTR? row comes from a repeat just past the window's right edge." src="/img/cookbook_color_by_type_two_ways.png"/>

## Pinning row colors in a track config

A track config can open the track in the partitioned view. `rowColor` pairs a
class with a color, so a class keeps its color as the window's class list
changes. This config sets no `rows.domain`, so the rows sort by class name, as
in the figure; a `rows.domain` listing classes puts them first, in that order.

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
      "rows": "repClass",
      "rowColor": {
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
      },
      "showRowSeparators": true
    }
  ]
}
```

A row not named in `rowColor` paints in the default block color. Setting
`unknown` in `rowColor` gives every unnamed row one color.

The track opens with the display listed **first**, so the multi-row entry makes
rows the default. Putting a bare `{ "type": "LinearBasicDisplay" }` ahead of it
keeps the packed form as the default and leaves the rows one menu click away.

## Checking the rows against the RepeatMasker file {#checking-the-rows-against-the-file}

To check the row heights, count the classes in the file over the window in the
figures:

```bash
tabix https://jbrowse.org/ucsc/hg38/rmsk.bed.gz chr17:45,700,000-45,750,000 |
  awk -F'\t' '{ n[$7]++; bp[$7] += $3 - $2 }
    END { for (c in n) printf "%s\t%d\t%d bp\n", c, n[c], bp[c] }' |
  sort -k3 -nr
```

The printed output lines up with the rows:

- Each printed class is a row with features on screen, and its bp total is the
  area drawn in that row.
- JBrowse fetches past the view's edges and builds rows from everything it
  fetched, so an empty row can come from a repeat just outside the window: the
  figures' empty `LTR?` row is `MamRep605`, past the right edge.
- A printed class with no row, or a row with features and no printed line, means
  the view is showing a different file.

The `Unknown` row is the control. Neither the `rowColor` above nor the
[cookbook's color lookup](/docs/cookbook#colors) names it, and it appears
because the rows come from the file. Pan to a window whose output has no
`Unknown` line and the row goes away.

The same command with `$6` instead of `$7` counts `repFamily`, which is the
finer partition (`L1`, `Alu`, `MIR`) if the classes turn out to be too coarse
for what you are reading.

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

The bed's columns are UCSC's first seven columns in UCSC's order, so the
`tabix | awk` check above reads the result unchanged.

## Reproduce it end to end

One script converts the `.out`, indexes it, and writes a runnable JBrowse with
the track already set to the multi-row display,
[`build_repeatmasker_classes.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_repeatmasker_classes.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_repeatmasker_classes.sh
bash build_repeatmasker_classes.sh genome.fa repeats.out  # builds ./repeatmasker_build/jbrowse2
npx --yes serve repeatmasker_build/jbrowse2               # then open the printed URL
```

`genome.fa` is the FASTA RepeatMasker was run against and `repeats.out` is its
`.out`; either may be gzipped.

On a genome UCSC also masks, compare the output with the UCSC conversion:

```bash
curl -o ucsc_rmsk.bed.gz https://jbrowse.org/ucsc/dm6/rmsk.bed.gz
diff <(gzip -dc repeatmasker_build/rmsk.bed.gz | grep -v '^#' | cut -f1-7 | sort) \
     <(gzip -dc ucsc_rmsk.bed.gz | grep -v '^#' | cut -f1-7 | sort)
```

No output means every interval, name, strand, family and class agrees with the
UCSC conversion of the same `.out`. A disagreement usually traces to the `.out`
quirks the awk comments name.

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/cookbook#colors)
- [](/docs/tutorials/chromhmm)

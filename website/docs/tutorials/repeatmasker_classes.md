---
title: RepeatMasker as one lane per class
sidebar_label: genomes.jbrowse.org (RepeatMasker lanes)
description:
  Split a hub's RepeatMasker track into a labelled lane per repeat class,
  without preparing any data
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
data: hosted
---

**TL;DR:** a RepeatMasker track is one packed lane of colored blocks. The same
file opened as a
[multi-row feature display](/docs/user_guides/multirow_feature_track) is one
labelled lane per class, whose height is that class's share of the window. The
class is already in the file, and the display discovers the lanes from it.

## Prerequisites

- nothing to install to read along: the RepeatMasker track is already on any
  genome at [genomes.jbrowse.org](https://genomes.jbrowse.org), or on any other
  UCSC/GenArk hub config
- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)); every file here is a URL, so Desktop
  needs nothing hosted
- htslib (`bgzip`, `tabix`, `htsfile`), for the check at the end
- `samtools`, for
  [serving your own RepeatMasker output](#serving-your-own-repeatmasker-output)
  only
- `node`, for
  [serving your own RepeatMasker output](#serving-your-own-repeatmasker-output)
  only

## Where the data comes from

The figures read UCSC's RepeatMasker track for hg38 and dm6, rehosted on
jbrowse.org.

- hg38, read by the tabix command under
  [Checking the lanes against the file](#checking-the-lanes-against-the-file):
  https://jbrowse.org/ucsc/hg38/rmsk.bed.gz
- dm6, the file the diff under
  [Reproduce it end to end](#reproduce-it-end-to-end) checks a home-built
  conversion against: https://jbrowse.org/ucsc/dm6/rmsk.bed.gz

## Where the class lives in the file

The two hub pipelines store it differently:

- A **UCSC golden-path** assembly ships a BED whose header names its columns,
  `repClass` among them. That is an attribute, so `partitionField` is just
  `"repClass"`.
- A **GenArk** assembly ships a `bigRmskBed`, whose autoSql has no class column
  at all. The class rides on the name as a suffix, `L1HS#LINE/L1`, so the value
  has to be derived. That case is worked in
  [](/docs/user_guides/multirow_feature_track#when-the-category-is-not-a-column).

Either way the rows are discovered from the values the loaded region holds, so a
window with no satellite has no satellite lane.

## Switching the track over

Open RepeatMasker, then **Display types → Multi-row feature display (painting)**
in the track menu. That splits the track on the `name` column, which is one row
per repeat, so the second pick is **Partition by... → repClass** in the same
menu, which lists the columns the loaded features carry. <!-- menu-path-ok -->

<Figure src="/img/multirow/display_types_menu.png" caption="The track menu's Display types submenu on the UCSC RepeatMasker track. Any feature track carries the multi-row display beside its default one." />

<Video src="/media/repeats/painting_display_switch.mp4" caption="The RepeatMasker track from one packed lane to a labelled lane per class: the multi-row painting display, then the repeat class column picked out of the ones the file carries." />

The colored, packed form and the lane form are the same track and the same
fetch:

<Figure caption="Top: UCSC RepeatMasker over a 17q21 window, colored by repClass through a jexl lookup table, with the display's legend slot as the key. Every class shares one packed lane. Bottom: the same track and window partitioned on repClass instead. SINE fills the window and LINE comes in clusters, and the LTR? and Unknown lanes are values in the file that the lookup table does not name." src="/img/cookbook_color_by_type_two_ways.png"/>

## Pinning the lanes in a track config

A track config makes the partitioned view the track's default instead of a menu
pick, and two more slots come with it: `sampleColorMap` is keyed by the class,
so a lane keeps its color as the window's class list changes, and `rowOrder`
fixes the lane order the same way.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "rmsk_hg38_rows",
  "name": "RepeatMasker by class",
  "assemblyNames": ["hg38"],
  "adapter": { "type": "BedTabixAdapter", "uri": "rmsk.bed.gz" },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "rmsk_hg38_rows-LinearMultiRowFeatureDisplay",
      "partitionField": "repClass",
      "sampleColorMap": {
        "SINE": "#e41a1c",
        "LINE": "#377eb8",
        "LTR": "#4daf4a",
        "DNA": "#984ea3",
        "Simple_repeat": "#ff7f00",
        "Low_complexity": "#a65628"
      },
      "showRowSeparators": true
    }
  ]
}
```

A lane not named in `sampleColorMap` takes a color from the categorical palette
by its position in the stack, so its color moves as the window's class list
changes.

Two things worth knowing about the config, both because their absence is silent:

- The display is not the track's default, so it needs a real `displays` entry
  rather than the `displayDefaults` shorthand, whose `color` would reach the
  default display as well.
- Whichever display is listed **first** becomes the one the track opens with.
  Putting a bare `{ "type": "LinearBasicDisplay", "displayId": ... }` ahead of
  the multi-row entry keeps the packed form as the default and leaves the lanes
  one menu click away.

## Checking the lanes against the file

The lane heights are a claim about the window, so read the same numbers out of
the file. Over the window in the figures:

```bash
tabix https://jbrowse.org/ucsc/hg38/rmsk.bed.gz chr17:45,700,000-45,750,000 |
  awk -F'\t' '{ n[$7]++; bp[$7] += $3 - $2 }
    END { for (c in n) printf "%s\t%d\t%d bp\n", c, n[c], bp[c] }' |
  sort -k3 -nr
```

The classes it prints are the lanes on screen, and their bp totals are the ink
in each lane. A lane in the picture with no line here, or the reverse, means the
view is not showing the file you think it is.

The `Unknown` lane is the control: no entry in the `sampleColorMap` above and
none in the cookbook's lookup table, and it is on screen anyway, because the
lanes come from the file. Pan to a window whose output has no `Unknown` line and
the lane goes away.

The same command with `$6` instead of `$7` counts `repFamily`, which is the
finer partition (`L1`, `Alu`, `MIR`) if the classes turn out to be too coarse
for what you are reading.

## Serving your own RepeatMasker output

Everything above reads a hub's track, whose BED already carries the `repClass`
column the display partitions on. RepeatMasker's own `.out` does not have one:
it writes a single `class/family` field, `LINE/L1` for a repeat with both and a
bare `Simple_repeat` for one whose family is its class. Splitting that field in
two, under a header naming the columns, is the whole difference between the
`.out` and the file the track above is reading:

<!-- from: scripts/build_repeatmasker_classes.sh -->

```bash
# the header names the columns, which is what lets `partitionField: "repClass"`
# name one the BED spec has never heard of
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

Those are UCSC's first seven columns in UCSC's order, so the `tabix | awk` check
above reads the result unchanged.

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
`.out`; either may be gzipped. Tools are under [Prerequisites](#prerequisites).
It runs the conversion above, `samtools faidx` over the FASTA for the assembly,
and `jbrowse add-track` with the display already set.

Run the script on a genome UCSC masks too, and its output can be compared
against UCSC's own:

```bash
curl -o ucsc_rmsk.bed.gz https://jbrowse.org/ucsc/dm6/rmsk.bed.gz
diff <(gzip -dc repeatmasker_build/rmsk.bed.gz | grep -v '^#' | cut -f1-7 | sort) \
     <(gzip -dc ucsc_rmsk.bed.gz | grep -v '^#' | cut -f1-7 | sort)
```

Silence means every interval, name, strand, family and class agrees with UCSC's
conversion of the same `.out`. The two places this can disagree are both in the
`.out` format: its coordinates are 1-based and inclusive where BED's are 0-based
and half-open, and its strand column spells the minus strand `C`.

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/cookbook#colors)
- [](/docs/tutorials/chromhmm)

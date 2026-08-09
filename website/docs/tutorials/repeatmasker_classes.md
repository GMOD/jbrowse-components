---
title: RepeatMasker as one lane per class
description:
  Split a hub's RepeatMasker track into a labelled lane per repeat class,
  without preparing any data
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

**TL;DR:** a RepeatMasker track is one packed lane of colored blocks, which says
what each block is but not how much of a window each class covers. The same file
opened as a
[multi-row feature display](/docs/user_guides/multirow_feature_track) is one
labelled lane per class. No new files: the class is already in the file, and the
display discovers the lanes from it.

## Prerequisites

- A genome from [jbrowse.org/genomes](https://jbrowse.org/genomes/), or any
  UCSC/GenArk hub config, which is where the RepeatMasker track comes from
- htslib (`tabix`), for the check at the end only

## The class is already in the file

The two hub pipelines store it differently, which is the only thing that changes
between them:

- A **UCSC golden-path** assembly ships a BED whose header names its columns,
  `repClass` among them. That is an attribute, so `partitionField` is just
  `"repClass"`.
- A **GenArk** assembly ships a `bigRmskBed`, whose autoSql has no class column
  at all. The class rides on the name as a suffix, `L1HS#LINE/L1`, so the value
  has to be derived. That case is worked in
  [](/docs/user_guides/multirow_feature_track#when-the-category-is-not-a-column).

Either way nothing lists the classes anywhere. Rows are discovered from the
values the loaded region holds, so a window with no satellite simply has no
satellite lane.

## Switching the track over

Open RepeatMasker, then **Display types → Multi-row feature display (painting)**
in the track menu.

<Figure src="/img/multirow/display_types_menu.png" caption="The track menu's Display types submenu on the UCSC RepeatMasker track. Any feature track carries the multi-row display beside its default one." />

That is the whole interaction. The colored, packed form and the lane form are
the same track and the same fetch:

<Figure caption="UCSC RepeatMasker over a 17q21 window, colored by repClass through a jexl lookup table. The key over the track is the display's legend slot. Every class shares one packed lane, so a class's blocks are interleaved with five others." src="/img/cookbook_color_by_type.png"/>

<Figure caption="The same track and window partitioned on repClass instead. SINE fills the window, LINE comes in clusters, and the sparse classes read as classes rather than as stray blocks. The LTR? and Unknown lanes are values in the file that the lookup table above does not name." src="/img/cookbook_color_by_type_rows.png"/>

## Pinning it in a config

Set it in the track config to have it open that way. `sampleColorMap` is keyed
by the class, so a lane keeps its color as the window's class list changes, and
`rowOrder` fixes the lane order the same way.

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

A lane not named in `sampleColorMap` is not an error, it just takes a color from
the categorical palette by its position in the stack, which is why naming the
classes you care about is worth the lines.

Two things worth knowing about the config, both because their absence is silent:

- The display is not the track's default, so it needs a real `displays` entry
  rather than the `displayDefaults` shorthand, whose `color` would reach the
  default display as well.
- Whichever display is listed **first** becomes the one the track opens with.
  Putting a bare `{ "type": "LinearBasicDisplay", "displayId": ... }` ahead of
  the multi-row entry keeps the packed form as the default and leaves the lanes
  one menu click away.

## Checking the lanes against the file

The lane heights are a real claim about the window, so read the same numbers out
of the file. Over the window in the figures:

```bash
tabix https://jbrowse.org/ucsc/hg38/rmsk.bed.gz chr17:45,700,000-45,750,000 |
  awk -F'\t' '{ n[$7]++; bp[$7] += $3 - $2 }
    END { for (c in n) printf "%s\t%d\t%d bp\n", c, n[c], bp[c] }' |
  sort -k3 -nr
```

The classes it prints are the lanes on screen, and their bp totals are the ink
in each lane. A lane in the picture with no line here, or the reverse, means the
view is not showing the file you think it is.

The `Unknown` lane is the control. It is not in the `sampleColorMap` above, it
is not in the cookbook's lookup table either, and it is on screen anyway,
because the lanes come from the file rather than from any list in the config.
Pan to a window whose output has no `Unknown` line and the lane goes away.

The same command with `$6` instead of `$7` counts `repFamily`, which is the
finer partition (`L1`, `Alu`, `MIR`) if the classes turn out to be too coarse
for what you are reading.

## See also

- [](/docs/user_guides/multirow_feature_track) - the display itself, including
  clustering, row sorting and the derived-value form GenArk needs
- [](/docs/cookbook#colors) - the same track colored by class instead of
  partitioned by it, and the jexl lookup table that does it
- [](/docs/tutorials/chromhmm) - the same display over a cohort of cell types

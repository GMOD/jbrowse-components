---
title: Multi-quantitative tracks
description: Multiple signal tracks displayed together
guide_category: Track types
---

A multi-quantitative track combines several quantitative signals (BigWig files,
typically) into one track with a shared Y axis. Rendering modes are switchable
from the track menu, in two families:

- **Multi-row** (`Multi-row XY plot`, `Multi-row density`, `Multi-row line`,
  `Multi-row scatter`) — one plot per subtrack, stacked
- **Overlapping** (`Overlapping XY plot`, `Overlapping lines`,
  `Overlapping scatter`) — all subtracks drawn together

<Figure caption="Multi-row XY plot (the default): each subtrack gets its own stacked plot, keeping its configured color." src="/img/multiwig/multirow_xy.png" />

<Figure caption="Overlapping XY plot: every subtrack is drawn together in one shared plot, with palette-assigned colors — good for directly comparing signal levels across samples." src="/img/multiwig/overlapping.png" />

Switch between them from the track menu's renderer-type submenu.

<Figure caption="The track menu lists the available renderer types." src="/img/multiwig/multi_renderer_types.png" />

In the multi-row modes the subtracks keep their configured colors. In the
overlapping modes the subtracks are auto-assigned colors from the palette. You
can edit colors and ordering from the track menu.

<Figure caption="The color/arrangement editor lets you change subtrack colors and reorder them in the row-based layouts." src="/img/multiwig/multi_colorselect.png" />

An outlier on one subtrack can blow out the shared Y axis. The "Local ± 3σ"
autoscale type clips to three standard deviations of the visible data, which
usually gives a more readable view. You can also pin the min and max from the
track menu.

## Adding a multi-quantitative track

Three ways to create one:

- **Add-track panel** — paste a list of BigWig URLs, or open multiple BigWig
  files from your machine
- **Track selector** — multi-select existing tracks and combine them into a
  multi-wiggle track from your selection
- **Hand-edit the config** — see the
  [multi-quantitative track configuration](/docs/config_guides/multiquantitative_track/)
  guide

<Figure caption="The add-track widget's workflow selector (red callout) lets you reach the multi-wiggle workflow, where you can paste a list of BigWig URLs or open multiple BigWig files from disk." src="/img/multiwig/addtrack.png" />
<Figure caption="In the track selector, the '...' menu adds individual tracks or whole categories to your selection. The cart icon in the add-track widget then turns the selection into a multi-wiggle track." src="/img/multiwig/trackselector.png" />

## Loading bedMethyl as a multi-quantitative track

[modkit](https://github.com/nanoporetech/modkit) pileup produces a
[bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) file — a
tab-separated BED format where each row reports the methylation fraction at a
single CpG position for one modification type (e.g. 5mC or 5hmC). It loads as
`BedTabixAdapter` and naturally maps to `MultiQuantitativeTrack`, with one
subtrack per modification type.

### Generating the file

```bash
modkit pileup sample.bam output.bedmethyl --ref reference.fa --preset traditional
bgzip output.bedmethyl
tabix -p bed output.bedmethyl.gz
```

`--preset traditional` produces 5mC calls (5hmC is combined into the 5mC
fraction). Omit it for separate 5mC and 5hmC rows.

### Add-track UI

In the add-track dialog, paste the URL to your `.bedmethyl.gz` file. JBrowse
detects the `.bedmethyl.gz` extension and selects **BedTabixAdapter** and
**MultiQuantitativeTrack** automatically.

### Config example

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "sample_modkit",
  "name": "CpG methylation (modkit)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": {
      "uri": "https://yourhost/sample_modkit.bedmethyl.gz"
    },
    "index": {
      "location": {
        "uri": "https://yourhost/sample_modkit.bedmethyl.gz.tbi"
      }
    }
  }
}
```

JBrowse reads the `score` column (column 11 in bedMethyl, the percent
methylation 0–100) and uses the `name` column (column 4, the modification code
such as `m` for 5mC or `h` for 5hmC) as the subtrack source label.

The COLO829 tumor modkit bedMethyl file is included in the
[demo config](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json)
as the track **"COLO829_tumor.ht_modkit.bed (as MultiQuantitativeTrack)"** under
the Methylation category (assembly hg38, chr21).

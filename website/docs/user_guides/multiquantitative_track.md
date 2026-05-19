---
id: multiquantitative_track
title: Multi-quantitative tracks
description: Multiple signal tracks displayed together
guide_category: Track types
---

JBrowse can show "Multi-quantitative tracks" which is a single track composed of
multiple quantitative signals, which have their Y-scalebar synchronized.

There are 5 rendering modes for the multi-quantitative tracks.

- xyplot
- multirowxyplot
- multiline
- multirowline
- multidensity

You can interactively change these settings through the track menu.

<Figure caption="Track menu for the multi-quantitative tracks showing different renderer types." src="/img/multiwig/multi_renderer_types.png" />

With the "multi-row" settings (multirowxyplot, multirowline, multidensity) the
track colors are not modified. For the overlapping (xyplot, multiline), the
tracks will be autoassigned a color from the palette. You can manually customize
the subtrack colors from the track menu as well.

<Figure caption="The color/arrangement editor for multi-quantitative tracks lets you change individual subtrack colors, or their ordering in the row based layouts." src="/img/multiwig/multi_colorselect.png" />

Oftentimes, one of the outliers on one of the subtracks may affect the
Y-scalebar too much, so it is often helpful to use the "Autoscale type → Local
+/- 3SD" setting (3 standard deviations are displayed). Manually configuring the
min or max scores is available via the track menu also.

### Adding multi-quantitative tracks via the UI

There are several ways to create multi-quantitative tracks from scratch.

1. Using the add track panel to open up a list of URLs for bigwig files, or from
   several local tracks from your machine
2. Using the track selector to add multiple tracks to your current selection,
   and then creating a multi-wiggle track from the tracks in your selection
3. Hardcoding the multiwiggle track in your config file (see
   [multi-quantitative track configuration](/docs/config_guides/multiquantitative_track/)
   for more info)

<Figure caption="Using the add track widget, you can use the select dropdown to access alternative 'add track workflows' including the multi-wiggle add track workflow. In the multiwiggle add track workflow, you can paste a list of bigWig file URLs, or open up multiple bigwig files from your computer." src="/img/multiwig/addtrack.png" />
<Figure caption="Using the track selector, you can add multiple tracks to your current selection. You can use the '...' dropdown menu to add a single track or a whole category of tracks to your selection. Then, the 'shopping cart' icon in the header of the add track widget lets you create a multi-wiggle track from your selection." src="/img/multiwig/trackselector.png" />

## Loading bedMethyl as a multi-quantitative track

[modkit](https://github.com/nanoporetech/modkit) pileup produces a
[bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) file — a
tab-separated BED format where each row reports the methylation fraction at a
single CpG position for one modification type (e.g. 5mC or 5hmC). Because the
format is a BED file it can be loaded with `BedTabixAdapter`, and because each
modification type produces its own score column the file maps naturally to a
`MultiQuantitativeTrack`.

### Generating the file

```bash
modkit pileup sample.bam output.bed --ref reference.fa --preset traditional
bgzip output.bed
tabix -p bed output.bed.gz
```

The `--preset traditional` flag produces 5mC calls (5hmC is combined into the
5mC fraction). Omit it for separate 5mC and 5hmC rows.

### Add-track UI

In the add-track dialog (`File → Open track...`), paste the URL to your
`.bedmethyl.gz` file. JBrowse detects the `.bedmethyl.gz` extension and
automatically selects **BedTabixAdapter** and **MultiQuantitativeTrack** — no
manual selection needed.

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
      "uri": "https://yourhost/sample_modkit.bed.gz"
    },
    "index": {
      "location": {
        "uri": "https://yourhost/sample_modkit.bed.gz.tbi"
      }
    }
  }
}
```

JBrowse reads the `score` column (column 11 in bedMethyl, the methylation
fraction 0–1) and the `name` column (column 4, the modification code such as `m`
for 5mC or `h` for 5hmC) as the subtrack source label.

The COLO829 tumor modkit bedMethyl file is included in the
[demo config](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json)
as the track **"COLO829_tumor.ht_modkit.bed (as MultiQuantitativeTrack)"** under
the Methylation category (assembly hg38, chr21).

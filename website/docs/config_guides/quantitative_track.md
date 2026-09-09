---
title: Quantitative track
description: BigWig/BedGraph signal track config and display options
guide_category: Track types
---

**TL;DR:** a `QuantitativeTrack` shows a single BigWig or bedGraph signal. Scale
and color options (`scaleType`, `autoscale`, `defaultRendering`, `color`, etc.)
go in `displayDefaults`.

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://yourhost/file.bw"
  },
  "displayDefaults": { "defaultRendering": "line", "scaleType": "log" }
}
```

## Display options

Scale and color settings (`scaleType`, `autoscale`, `minScore`, `maxScore`,
`color`, `bicolorPivot`) are
[`LinearWiggleDisplay`](/docs/config/linearwiggledisplay) slots, set through
`displayDefaults`.
[`defaultRendering`](/docs/config/linearwiggledisplay/#slot-defaultrendering)
picks `xyplot`, `density`, `line` or `scatter`. The
[cookbook](/docs/cookbook#quantitative-wiggle-tracks) has the single-color and
bicolor recipes.

## Adapters

`BigWigAdapter`, `BedGraphTabixAdapter` (bgzip plus tabix, for large data) and
`BedGraphAdapter` (a small plain `.bedGraph`) all take the `uri` shorthand;
[supported file types](/docs/config_guides/file_types#quantitative--signal)
lists them with their config pages.

## Any numeric column of a feature file

The wiggle display also draws on a `FeatureTrack`: name it in the track's
`displays`, and
[`scoreField`](/docs/config/linearwiggledisplay/#slot-scorefield) picks the
column it plots. The default `score` reads the BED score column, or whatever the
adapter's `scoreColumn` rewrote it to; an explicit field name reaches a raw
column of the file instead, so a BED with a `coverage` column plots as a signal
without a conversion to bedGraph:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "coverage_bed",
  "name": "Coverage",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://yourhost/coverage.bed.gz"
  },
  "displays": [{ "type": "LinearWiggleDisplay", "scoreField": "coverage" }]
}
```

The same track offers the Manhattan plot under the track menu's **Display
types**; the
[GWAS track guide](/docs/config_guides/gwas_track#any-scored-feature-file)
covers it.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multiquantitative_track)

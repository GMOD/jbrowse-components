---
title: Quantitative tracks
description: BigWig/BedGraph signal track config and display options
guide_category: Track types
---

## QuantitativeTrack config

Example QuantitativeTrack config:

```json
{
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "type": "QuantitativeTrack",
  "adapter": {
    "type": "BigWigAdapter",
    "bigWigLocation": {
      "uri": "http://yourhost/file.bw",
      "locationType": "UriLocation"
    }
  }
}
```

### Display options

Scale, autoscale, and color options (`scaleType`, `autoscale`, `minScore`,
`maxScore`, `defaultRendering`, `color`, `bicolorPivot`, etc.) are appearance
settings. Put them in a `displayDefaults` object and JBrowse applies them to the
wiggle display for you — no need to know the display's name
(`LinearWiggleDisplay`):

```json
{
  "type": "QuantitativeTrack",
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "http://yourhost/file.bw"
  },
  "displayDefaults": { "scaleType": "log" }
}
```

For per-display control, use the `displays` array form (see the
[track config guide](/docs/config_guides/tracks/#configuring-displays)). See the
[LinearWiggleDisplay config docs](/docs/config/linearwiggledisplay) for the full
list of display slots and their defaults.

### Adapters

BigWig (`BigWigAdapter`) and bedGraph are both supported. For bedGraph, use
`BedGraphTabixAdapter` (a bgzip+tabix-indexed file) for large data, or
`BedGraphAdapter` for a small plain `.bedGraph`. The example above uses the
reduced `uri` form; see the [BigWigAdapter](/docs/config/bigwigadapter),
[BedGraphTabixAdapter](/docs/config/bedgraphtabixadapter), and
[BedGraphAdapter](/docs/config/bedgraphadapter) config docs for all options.

## See also

- [Quantitative track](/docs/user_guides/quantitative_track) — renderer types,
  autoscaling, and CNV profiling in the app
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) —
  combining several signals on a shared axis

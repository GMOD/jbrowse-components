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

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multiquantitative_track)

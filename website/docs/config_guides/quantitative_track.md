---
title: Quantitative tracks
description: BigWig/BedGraph signal track config and display options
guide_category: Track types
---

### QuantitativeTrack config

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

#### Display options

Scale, autoscale, and color options (`scaleType`, `autoscale`, `minScore`,
`maxScore`, `defaultRendering`, `color`, `bicolorPivot`, etc.) live on
`LinearWiggleDisplay`, not on the track. Setting them at the track top level has
no effect — nest them in a `displays` entry to change the defaults:

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
  "displays": [
    {
      "type": "LinearWiggleDisplay",
      "scaleType": "log"
    }
  ]
}
```

See the [LinearWiggleDisplay config docs](/docs/config/linearwiggledisplay) for
the full list of display slots and their defaults.

#### Adapters

BigWig (`BigWigAdapter`) and bedGraph (`BedGraphTabixAdapter`, for a
bgzip+tabix-indexed file) are both supported. The example above uses the reduced
`uri` form; see the [BigWigAdapter](/docs/config/bigwigadapter) and
[BedGraphTabixAdapter](/docs/config/bedgraphtabixadapter) config docs for all
options.

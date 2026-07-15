---
title: Hi-C track
description: Contact matrix track config using the HicAdapter
guide_category: Track types
---

Example Hi-C track config:

```json
{
  "type": "HicTrack",
  "trackId": "hic",
  "name": "Hi-C Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "HicAdapter",
    "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic"
  }
}
```

## HicAdapter config

The `HicAdapter` needs only the `.hic` file location, given here with the `uri`
shorthand. The longhand form uses a `hicLocation` slot. See the
[HicAdapter config docs](/docs/config/hicadapter) for all options.

## Color scheme

Hi-C contact matrices are drawn with a built-in color ramp, selectable from the
track menu via the
[`colorScheme`](/docs/config/linearhicdisplay/#slot-colorscheme) slot:
`juicebox`, `fall`, or `viridis`. Log scaling and percentile clipping are also
slots. See the [LinearHicDisplay config docs](/docs/config/linearhicdisplay) for
the full list.

## Loops and interactions as arcs

BEDPE loop/interaction calls load as a `VariantTrack` with a
`LinearPairedArcDisplay`. `color` is jexl-evaluated per feature and `lineWidth`
sets the arc stroke width in pixels (also draggable from the track menu). This
example draws only the high-scoring calls, in dark red, as thin arcs:

```json
{
  "type": "VariantTrack",
  "trackId": "hic_loops",
  "name": "Hi-C loops",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedpeAdapter",
    "bedpeLocation": { "uri": "https://example.com/loops.bedpe.gz" }
  },
  "displays": [
    {
      "type": "LinearPairedArcDisplay",
      "displayId": "hic_loops-LinearPairedArcDisplay",
      "color": "jexl:get(feature,'score')>=500?'#8b1a1a':'rgba(0,0,0,0)'",
      "lineWidth": 1
    }
  ]
}
```

## See also

- [Hi-C track](/docs/user_guides/hic_track), loading and interpreting contact
  matrices in the app
- [LinearPairedArcDisplay config schema](/docs/config/linearpairedarcdisplay),
  arc display slots

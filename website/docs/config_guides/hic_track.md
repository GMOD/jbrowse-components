---
title: Hi-C track
description: Contact matrix track config using the HicAdapter
guide_category: Track types
---

**TL;DR:** a `HicTrack` with a `HicAdapter` needs only the `.hic` file location.
Loop and interaction calls (BEDPE) are a separate `VariantTrack` drawn with a
`LinearPairedArcDisplay`.

Example Hi-C track config:

```json addtrack
{
  "type": "HicTrack",
  "trackId": "hic",
  "name": "Hi-C Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "HicAdapter",
    "uri": "https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic"
  }
}
```

## HicAdapter config

The `HicAdapter` needs only the `.hic` file location, given here with the `uri`
shorthand. The longhand form uses a `hicLocation` slot. See the
[HicAdapter config docs](/docs/config/hicadapter) for all options.

## Color scheme

[`colorScheme`](/docs/config/linearhicdisplay/#slot-colorscheme) takes
`juicebox`, `fall`, or `viridis`. Log scaling
([`useLogScale`](/docs/config/linearhicdisplay/#slot-uselogscale)) and
percentile clipping
([`useColorPercentile`](/docs/config/linearhicdisplay/#slot-usecolorpercentile))
are slots too, as are the overlay's legend
([`showLegend`](/docs/config/linearhicdisplay/#slot-showlegend)) and binsize
dropdown
([`showResolutionControls`](/docs/config/linearhicdisplay/#slot-showresolutioncontrols)).
See the [LinearHicDisplay config docs](/docs/config/linearhicdisplay) for the
full list, and
[adjusting the color scale](/docs/user_guides/hic_track#adjusting-the-color-scale)
for what each one does to the picture.

## Normalization and resolution

[`selectedNormalization`](/docs/config/linearhicdisplay/#slot-selectednormalization)
names the matrix-balancing scheme to request (`KR`, `SCALE`, `VC`, `VC_SQRT`,
`NONE`). It is resolved at runtime against what the file actually provides, so a
config naming a scheme the file lacks falls back rather than erroring — see
[normalization](/docs/user_guides/hic_track#normalization).

[`resolutionBias`](/docs/config/linearhicdisplay/#slot-resolutionbias) is a
signed offset from the zoom-derived binsize rather than an absolute binsize, so
the choice stays meaningful as the view zooms: negative is finer, positive
coarser.

```json addtrack
{
  "type": "HicTrack",
  "trackId": "hic_kr",
  "name": "Hi-C (KR, log scale)",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "HicAdapter",
    "uri": "https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic"
  },
  "displayDefaults": {
    "selectedNormalization": "KR",
    "useLogScale": true,
    "showLegend": true
  }
}
```

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

- [](/docs/user_guides/hic_track)
- [LinearPairedArcDisplay config schema](/docs/config/linearpairedarcdisplay)

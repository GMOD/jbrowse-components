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

The display's slots for the coloring and its controls:

- [`colorScheme`](/docs/config/linearhicdisplay/#slot-colorscheme) — `juicebox`,
  `fall`, or `viridis`
- [`useLogScale`](/docs/config/linearhicdisplay/#slot-uselogscale) — log scaling
- [`useColorPercentile`](/docs/config/linearhicdisplay/#slot-usecolorpercentile)
  — percentile clipping
- [`showLegend`](/docs/config/linearhicdisplay/#slot-showlegend) — the overlay's
  legend
- [`showResolutionControls`](/docs/config/linearhicdisplay/#slot-showresolutioncontrols)
  — the binsize dropdown

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
signed offset from the zoom-derived binsize, so the choice stays meaningful as
the view zooms: negative is finer, positive coarser.

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

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hic_loops",
  "name": "Hi-C loops",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedpeAdapter",
    "uri": "https://example.com/loops.bedpe.gz"
  },
  "displays": [
    {
      "type": "LinearPairedArcDisplay",
      "color": "jexl:feature.score>=500?'#8b1a1a':'rgba(0,0,0,0)'",
      "lineWidth": 1
    }
  ]
}
```

## Compartments and subcompartments

The compartment eigenvector is a BigWig and needs nothing beyond its location.
The bicolor rendering around zero is what a
[quantitative track](/docs/config_guides/quantitative_track) does with signed
data by default; set
[`minScore`](/docs/config/linearwiggledisplay/#slot-minscore) and
[`maxScore`](/docs/config/linearwiggledisplay/#slot-maxscore) when two of these
tracks have to be read against each other, so neither autoscales to its own
extremes:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "hic_compartments",
  "name": "Compartment eigenvector",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/5b488af0-df49-4b9b-9feb-8ad671b7eaef/ENCFF661LPK.bigWig"
  },
  "displayDefaults": {
    "minScore": -0.03,
    "maxScore": 0.03
  }
}
```

Subcompartments are a BED whose color column carries the class color. ENCODE's
copies are not tabix-indexed, so they load with the plain
[`BedAdapter`](/docs/config/bedadapter), which reads the whole file — a few
hundred kilobytes here:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hic_subcompartments",
  "name": "Subcompartments",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "https://encode-public.s3.amazonaws.com/2022/08/26/7165fc3e-f186-4fba-be87-f4ea600404b0/ENCFF247IAA.bed.gz",
    "columnNames": [
      "chrom",
      "chromStart",
      "chromEnd",
      "name",
      "score",
      "strand",
      "thickStart",
      "thickEnd",
      "itemRgb",
      "numAltClusterings",
      "altClusterNum",
      "altClusterAssignment"
    ]
  }
}
```

[`columnNames`](/docs/config/bedadapter/#slot-columnnames) is doing two jobs
here. The file has twelve columns whose last three are not BED12's block fields,
so under the positional BED layout the cluster count is taken for a `blockCount`
and every feature grows a row of nonexistent subfeatures. Naming column nine
`itemRgb` is what makes the classes paint their own colors: the file's own
header spells it `itemRGB`, which is not the name JBrowse looks for, and the
header would not be consulted anyway because a second comment line follows the
column line — the parser takes the last header line as the definition, and that
one has no tab-separated fields. Neither failure raises an error.

## See also

- [](/docs/user_guides/hic_track)
- [LinearPairedArcDisplay config schema](/docs/config/linearpairedarcdisplay)
- [](/docs/tutorials/hic_structural_variants)

---
title: Hi-C track
description: Contact matrix track config using the HicAdapter
guide_category: Track types
---

A `HicTrack` with a `HicAdapter` needs only the `.hic` file location. Loop and
interaction calls (BEDPE) are a separate `VariantTrack` drawn as link marks on a
`LinearMarkDisplay`.

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

`HicAdapter` takes the `.hic` file through the `uri` shorthand; the longhand
slot is `hicLocation` ([](/docs/config/hicadapter)).

## Display settings

The coloring and its controls are [](/docs/config/linearhicdisplay) slots, and
[adjusting the color scale](/docs/user_guides/hic_track#adjusting-the-color-scale)
shows what each does to the picture:

```json addtrack
{
  "trackId": "hic_kr",
  "name": "Hi-C (KR, log scale)",
  "uri": "https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic",
  "assemblyNames": ["hg19"],
  "displayDefaults": {
    "data": { "normalization": "KR" },
    "encoding": {
      "color": { "scale": { "type": "log", "scheme": "viridis" } }
    },
    "legend": { "show": true }
  }
}
```

- **[`data.normalization`](/docs/config/hicdata/#slot-normalization)** names the
  matrix-balancing scheme (`KR`, `SCALE`, `VC`, `VC_SQRT`, `NONE`). JBrowse
  resolves it against what the file provides, so a scheme the file lacks falls
  back with no error
  ([normalization](/docs/user_guides/hic_track#normalization))
- **[`data.resolution`](/docs/config/hicdata/#slot-resolution)** is a signed
  offset from the zoom-derived binsize, so the choice survives zooming: positive
  is finer, negative coarser
- **[`encoding.color.scale.domainMax`](/docs/config/hiccolor/#slot-scaledomainmax)**
  pins the count the color scale saturates at. Unset, it follows the loaded
  counts, so two tracks given the same number share one scale
- **[`encoding.color.field`](/docs/config/hiccolor/#slot-field)** is `observed`,
  the counts, or `observed/expected`, each count over the file's expected count
  at its distance, drawn diverging around 1
  ([compartments](/docs/user_guides/hic_track#compartments-and-subcompartments))

## Comparing two conditions

A [`controlAdapter`](/docs/config/hicadapter/#slot-controladapter) on the
adapter names a second `.hic`, and the
[`observed/control`](/docs/config/hiccolor/#slot-field) field draws each count
over the control's, both scaled to one library depth. This track is K562 over
GM12878:

```json addtrack
{
  "type": "HicTrack",
  "trackId": "hic_k562_over_gm12878",
  "name": "K562 over GM12878",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "HicAdapter",
    "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/4d332729-3463-4782-b33c-76e4fa8ff72a/ENCFF080DPJ.hic",
    "controlAdapter": {
      "type": "HicAdapter",
      "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/6f0cc163-86c7-4a68-baac-65af90f5a90d/ENCFF053VBX.hic"
    }
  },
  "displayDefaults": { "encoding": { "color": "observed/control" } }
}
```

The track menu's **Compare with...** builds the same track from two tracks
already loaded
([comparing two conditions](/docs/user_guides/hic_track#comparing-two-conditions)).

## Loops and interactions as arcs

BEDPE loop calls load as a `VariantTrack` with a
[mark display](/docs/config_guides/mark_display) drawing one `link` per call: a
`mate` step reads each record's other end, `x2` names the fields holding it,
`strokeWidth` is the stroke in pixels and `color` the stroke color. A `filter`
step keeps the high-scoring calls, drawn here in dark red as thin arcs:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hic_loops",
  "name": "Hi-C loops",
  "uri": "https://example.com/loops.bedpe.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "marks": [
        {
          "mark": "link",
          "encoding": { "color": { "value": "#8b1a1a" }, "strokeWidth": 1 },
          "transform": [
            { "type": "mate" },
            { "type": "filter", "expr": "jexl:get(feature,'score')>=500" }
          ]
        }
      ]
    }
  ]
}
```

A `strokeWidth` bound to a field strokes each loop by its score instead, through
a linear or log scale into a range of pixels:
[](/docs/config_guides/mark_display) §"Links".

## Compartments and subcompartments

The compartment eigenvector is a BigWig, drawn as a
[quantitative track](/docs/config_guides/quantitative_track) in two colors
around zero. Pin
[`encoding.y.scale.domainMin`](/docs/config/yscale/#slot-domainmin) and
[`domainMax`](/docs/config/yscale/#slot-domainmax) when two of these tracks are
read against each other, so neither autoscales to that track's extremes; the
[user guide](/docs/user_guides/hic_track#compartments-and-subcompartments)
covers the sign check that goes with it:

```json addtrack
{
  "trackId": "hic_compartments",
  "name": "Compartment eigenvector",
  "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/5b488af0-df49-4b9b-9feb-8ad671b7eaef/ENCFF661LPK.bigWig",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "encoding": { "y": { "scale": { "domainMin": -0.03, "domainMax": 0.03 } } }
  }
}
```

Subcompartments are a BED whose color column holds the class color. ENCODE's
copies are not tabix-indexed, so the plain
[`BedAdapter`](/docs/config/bedadapter) reads the whole file:

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

[`columnNames`](/docs/config/bedadapter/#slot-columnnames) does two jobs here,
and neither failure it prevents raises an error:

- **The file's last three columns are not BED12's block fields**, so the
  positional layout takes the cluster count for a `blockCount` and grows every
  feature a row of nonexistent subfeatures
- **Column nine named `itemRgb`** paints each class in a separate color. The
  file's header spells it `itemRGB`, which JBrowse does not look for, and a
  second comment line follows the column line, so the parser takes that last
  line as the definition and finds no tab-separated fields in it

## See also

- [](/docs/user_guides/hic_track)
- [LinearMarkDisplay config schema](/docs/config/linearmarkdisplay)
- [](/docs/tutorials/hic_structural_variants)

---
title: Quantitative track
description: BigWig/BedGraph signal track config and display options
guide_category: Track types
---

A `QuantitativeTrack` shows a single BigWig or bedGraph signal; a
`MultiQuantitativeTrack` carries several of them in one display. Both draw
through `LinearWiggleDisplay`, so the scale, colour and layout settings below
apply to either, through `displayDefaults`.

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
  "displayDefaults": {
    "defaultRendering": "line",
    "scales": { "y": { "type": "log" } }
  }
}
```

## Display options

The axis is one object, [`scales.y`](/docs/config/valuescale), the colour is one
object, [`color`](/docs/config/linearwiggledisplay/#slot-color), and
[`facet`](/docs/config/linearwiggledisplay/#slot-facet) decides the layout; all
three are [`LinearWiggleDisplay`](/docs/config/linearwiggledisplay) slots and
all three go through `displayDefaults`.

[`defaultRendering`](/docs/config/linearwiggledisplay/#slot-defaultrendering)
picks `xyplot`, `density`, `line`, `linecenter` or `scatter`. Those five say
what a signal is drawn as; `facet` says how many rows there are, so the two can
be set independently.

Reference lines belong to the axis object too.
[`scales.y.rules`](/docs/config/valuescale/#slot-scalesyrules) draws a dashed
line across the plot at each value, a bare number or `{ value, color, label }`,
in every row of a faceted track:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "tumor_depth",
  "name": "Tumor depth",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://yourhost/tumor_depth.bw"
  },
  "displayDefaults": {
    "scales": {
      "y": { "rules": [{ "value": 30, "label": "2 copies" }, 15] }
    }
  }
}
```

An autoscaled end of the axis widens to keep every rule on it, so a rule stays
drawn over a deletion the coverage never climbs out of, and a pinned `domainMin`
or `domainMax` that excludes a rule drops it. A label is free text: JBrowse
assumes no ploidy, so "2 copies" is the author's claim. The `density` rendering
draws no rules, having no axis to rule.

A reader adds the same lines without a config file: the track menu's score
submenu opens **Reference lines**, which writes this list.

## Colors

`color` is a CSS color string, or an object naming the field it reads and the
scale it reads through:

| the picture                         | the value                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| one solid colour                    | `"#8b0000"`                                                                            |
| a colour each side of a cut         | `{ "field": "score", "scale": "threshold", "domain": [5], "range": ["#aaa", "#f00"] }` |
| a ramp, which density fades through | `{ "field": "score", "scale": "linear", "scheme": "viridis" }`                         |
| a colour per source                 | `{ "field": "source", "scale": "categorical" }`                                        |

A threshold with an empty `domain` cuts at
[`origin`](/docs/config/linearwiggledisplay/#slot-origin), the value the bars
also grow from. A ramp takes a named `scheme` or a `range` of CSS stops, runs
straight across the y domain unless `domainMid` places its middle stop, and with
one colour runs from white to it. The
[cookbook](/docs/cookbook#quantitative-wiggle-tracks) has worked recipes.

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

This FeatureTrack also offers the Manhattan plot under the track menu's
**Display types**; the
[GWAS track guide](/docs/config_guides/gwas_track#any-scored-feature-file)
covers it.

## Many signals in one track

A `MultiQuantitativeTrack` puts many BigWig/bedGraph signals in one display. Use
the `bigWigs` array for a plain list of URLs, or `subadapters` when you need
per-subtrack `color`, `group`, and `source`.

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "microarray_multi",
  "name": "MultiWig",
  "category": ["ENCODE bigWigs"],
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "bigWigs": [
      "https://www.encodeproject.org/files/ENCFF055ZII/@@download/ENCFF055ZII.bigWig",
      "https://www.encodeproject.org/files/ENCFF826HEW/@@download/ENCFF826HEW.bigWig",
      "https://www.encodeproject.org/files/ENCFF858LIM/@@download/ENCFF858LIM.bigWig",
      "https://www.encodeproject.org/files/ENCFF425TNW/@@download/ENCFF425TNW.bigWig"
    ]
  }
}
```

The track type seeds `facet: "source"`, `summaryScoreMode: "avg"` and a 200px
height into its `displayDefaults`, so it opens as one row per source without
saying so; a key the config spells wins over the seed. `facet: ""` puts every
source back in one shared plot box, and
`facet: { "field": "source", "domain": […] }` names the sources that lead the
row order.

### The subadapters form

Each subtrack carries a `source`: its label in the UI, and `feature.source` in a
[jexl color callback](/docs/config_guides/jexl)
(`jexl:feature.source=='k1'?'red':'blue'`). `bigWigs` derives it from the file
name; `subadapters` sets it explicitly (`name` is an alias, and `source` wins
when both are set), plus a default `color` and a `group` label
([](/docs/config/multiwiggleadapter)):

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "microarray_multi_groups",
  "name": "MultiWig (groups)",
  "category": ["ENCODE bigWigs"],
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "source": "k1",
        "color": "red",
        "uri": "https://www.encodeproject.org/files/ENCFF055ZII/@@download/ENCFF055ZII.bigWig",
        "group": "group1"
      },
      {
        "type": "BigWigAdapter",
        "source": "k2",
        "color": "blue",
        "uri": "https://www.encodeproject.org/files/ENCFF826HEW/@@download/ENCFF826HEW.bigWig",
        "group": "group2"
      }
    ]
  }
}
```

`subadapters` is an array of objects, so it templates from a samplesheet such as
an RNA-seq timecourse:

```js
// rows: [{ timepoint: '0h', bigwig: 's3://.../t0.bw' }, ...]
const track = {
  type: 'MultiQuantitativeTrack',
  trackId: 'rnaseq-timecourse', // keep this stable across rebuilds
  name: 'RNA-seq timecourse',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: rows.map(row => ({
      type: 'BigWigAdapter',
      source: row.timepoint,
      uri: row.bigwig,
    })),
  },
}
```

[](/docs/config_guides/deploying) generates a whole `config.json` this way in a
CI/CD pipeline.

### Loading bedMethyl as a multi-quantitative track

A [bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) from
[modkit pileup](https://github.com/nanoporetech/modkit) reports the methylation
fraction at each CpG, one row per modification type. Bgzipped and tabix-indexed
(the [methylation tutorial](/docs/tutorials/methylation) has the commands), it
loads through `BedTabixAdapter` as a `MultiQuantitativeTrack` with one subtrack
per modification type; a `.bedmethyl.gz` also auto-detects as this in the Add
track form:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "sample_modkit",
  "name": "CpG methylation (modkit)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://yourhost/sample_modkit.bedmethyl.gz"
  }
}
```

JBrowse reads two columns: `score` (column 11), the percent methylation from 0
to 100, and `name` (column 4), the modification code (`m` for 5mC, `h` for 5hmC)
used as the subtrack label.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/clustering)

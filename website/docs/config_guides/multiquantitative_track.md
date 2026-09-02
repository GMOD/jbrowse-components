---
title: Multi-quantitative track
description: Multiple BigWig/BedGraph signals combined into one display
guide_category: Track types
---

**TL;DR:** a `MultiQuantitativeTrack` overlays many BigWig/bedGraph signals in
one display. Use the `bigWigs` array for quick absolute-URL setups, or
`subadapters` when you need relative URLs or per-subtrack `color`, `group`, and
`source`.

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

<!-- GOTCHA MultiWiggleAdapter START -->

:::caution Gotcha

The `bigWigs` shorthand only accepts **absolute** URLs; a relative path there
will not resolve against the config's location. Use the `subadapters` form for
relative URLs, which is also what you need for per-subtrack `color`, `group`,
and `source`.

:::

<!-- GOTCHA MultiWiggleAdapter END -->

## The subadapters form

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

## Loading bedMethyl as a multi-quantitative track

A [bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) from
[modkit pileup](https://github.com/nanoporetech/modkit) reports the methylation
fraction at each CpG, one row per modification type. Bgzipped and tabix-indexed
(the [methylation tutorial](/docs/tutorials/methylation) has the commands), it
loads through `BedTabixAdapter` as a `MultiQuantitativeTrack` with one subtrack
per modification type, which is also what a `.bedmethyl.gz` auto-detects as in
the Add track form:

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

- [](/docs/user_guides/multiquantitative_track)
- [](/docs/user_guides/quantitative_track)

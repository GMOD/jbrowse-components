---
title: Multi-quantitative track
description: Multiple BigWig/BedGraph signals combined into one display
guide_category: Track types
---

**TL;DR:** a `MultiQuantitativeTrack` overlays many BigWig/bedGraph signals in
one display. Use the `bigWigs` array for quick absolute-URL setups, or
`subadapters` when you need relative URLs or per-subtrack `color`, `group`, and
`source`.

## MultiQuantitativeTrack config

Example MultiQuantitativeTrack config:

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

### The source field

Each subtrack has a `source` identifier used as its label in the UI and carried
on features as `feature.get('source')`. When using `bigWigs`, `source` is
auto-derived from the URL filename. When using `subadapters`, set it explicitly.
`name` is an alias, and `source` takes priority if both are set.

Since features carry a `source` attribute, you can reference it in
[jexl color callbacks](/docs/config_guides/jexl), e.g.
`jexl:feature.source=='k1'?'red':'blue'`.

The `subadapters` slot also supports:

- `color` - default subtrack color
- `group` - grouping label for organizing subtracks

Example:

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

See the [MultiWiggleAdapter config docs](/docs/config/multiwiggleadapter) for
all options.

### Generating the subadapters from a samplesheet

Because `subadapters` is just an array of objects, it templates cleanly from
repetitive data like an RNA-seq timecourse. Given rows of
`{ timepoint, bigwig }`, build the track in a script:

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

See [](/docs/config_guides/deploying) for the full pattern of generating
`config.json` from a samplesheet in a CI/CD pipeline.

## Loading bedMethyl as a multi-quantitative track

[modkit](https://github.com/nanoporetech/modkit) pileup produces a
[bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) file, a
tab-separated BED format where each row reports the methylation fraction at a
single CpG position for one modification type (e.g. 5mC or 5hmC). It loads as
`BedTabixAdapter` and maps to `MultiQuantitativeTrack`, with one subtrack per
modification type:

```bash
modkit pileup sample.bam output.bedmethyl --ref reference.fa --preset traditional
bgzip output.bedmethyl
tabix -p bed output.bedmethyl.gz
```

`--preset traditional` produces 5mC calls (5hmC is combined into the 5mC
fraction). Omit it for separate 5mC and 5hmC rows.

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

JBrowse reads two of the columns:

- `score` (column 11) — the percent methylation, 0–100
- `name` (column 4) — the modification code, such as `m` for 5mC or `h` for
  5hmC, used as the subtrack source label

In the "Add a track" form, pasting the URL to a `.bedmethyl.gz` file
auto-detects `BedTabixAdapter` and `MultiQuantitativeTrack`.

## See also

- [](/docs/user_guides/multiquantitative_track)
- [](/docs/user_guides/quantitative_track)

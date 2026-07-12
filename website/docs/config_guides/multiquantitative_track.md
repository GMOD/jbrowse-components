---
title: Multi-quantitative tracks
description: Multiple BigWig/BedGraph signals combined into one display
guide_category: Track types
---

## MultiQuantitativeTrack config

Example MultiQuantitativeTrack config:

```json
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

The `bigWigs` array only works with absolute URLs. For relative URLs or
per-subtrack options like color and grouping, use `subadapters` instead.

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

```json
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
`{ timepoint, bigwig }`, build the track in a script rather than by hand:

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

See [Deploying JBrowse Web](/docs/config_guides/deploying) for the full pattern
of generating `config.json` from a samplesheet in a CI/CD pipeline.

## See also

- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) — using
  multi-quantitative tracks, bedMethyl, and clustering in the app
- [Quantitative track](/docs/user_guides/quantitative_track) — single-signal
  display

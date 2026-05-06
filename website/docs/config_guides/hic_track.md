---
id: hic_track
title: Hi-C track configuration
---

Example Hi-C track config:

```json
{
  "type": "HicTrack",
  "trackId": "hic",
  "name": "HiC Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "HicAdapter",
    "hicLocation": {
      "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic",
      "locationType": "UriLocation"
    }
  }
}
```

#### HicAdapter config

The HicAdapter currently only requires a `hicLocation`:

```json
{
  "type": "HicAdapter",
  "hicLocation": {
    "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic",
    "locationType": "UriLocation"
  }
}
```

A reduced form is also accepted:

```json
{
  "type": "HicAdapter",
  "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic"
}
```

#### HicRenderer config

- `baseColor` - the base color of the Hi-C plot (default `#f00`). Change to e.g.
  `#00f` for blue shading
- `color` - a color callback that maps a contact count to a rendered color. The
  default is `jexl:interpolate(count,scale)`, where `count` is the contact count
  for the block, `maxScore` is the maximum count in the current view,
  `baseColor` is the configured base color, and `scale` is a pre-built
  interpolator from white to `baseColor` (see
  [configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicRenderer/configSchema.ts)
  for the current defaults)

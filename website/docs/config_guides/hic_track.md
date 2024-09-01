---
id: hic_track
title: Hi-C track configuration
---

Example Hi-C track config:

```json
{
  "type": "HicTrack",
  "trackId": "hic",
  "name": "Hic Track",
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

We just simply supply a `hicLocation` currently for the HicAdapter:

```json
{
  "type": "HicAdapter",
  "hicLocation": {
    "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic",
    "locationType": "UriLocation"
  }
}
```

#### HicRenderer config

- `baseColor` - the default baseColor of the Hi-C plot is red #f00, you can
  change it to blue so then the shading will be done in blue with #00f
- `color` - this is a color callback that adapts the current Hi-C contact
  feature with the baseColor to generate a shaded block. The default color
  callback function is
  `jexl:baseColor.alpha(Math.min(1,count/(maxScore/20))).hsl().string()` where
  it receives the count for a particular block, the maxScore over the region,
  and the baseColor from the baseColor config

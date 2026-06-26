---
title: Hi-C track configuration
description: Contact matrix track config using the HicAdapter
guide_category: Track types
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

## HicAdapter config

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

A reduced form is also accepted (see the
[HicAdapter config docs](/docs/config/hicadapter) for all options):

```json
{
  "type": "HicAdapter",
  "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic"
}
```

## Color scheme

Hi-C contact matrices are drawn with a built-in color ramp, selectable from the
track menu. Available schemes are `juicebox` (default), `fall`, and `viridis`.

## See also

- [Hi-C track](/docs/user_guides/hic_track) — loading and interpreting contact
  matrices in the app

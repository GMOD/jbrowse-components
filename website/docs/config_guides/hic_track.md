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
  "name": "Hi-C Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "HicAdapter",
    "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic"
  }
}
```

## HicAdapter config

The `HicAdapter` needs only the `.hic` file location, given here with the `uri`
shorthand. The longhand form uses a `hicLocation` slot — see the
[HicAdapter config docs](/docs/config/hicadapter) for all options.

## Color scheme

Hi-C contact matrices are drawn with a built-in color ramp, selectable from the
track menu. Available schemes are `juicebox` (default), `fall`, and `viridis`.
See the [LinearHicDisplay config docs](/docs/config/linearhicdisplay) for the
full list of display slots.

## See also

- [Hi-C track](/docs/user_guides/hic_track) — loading and interpreting contact
  matrices in the app

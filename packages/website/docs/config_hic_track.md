---
id: config_hic_track
title: Hi-C track configuration
---

Technically there is no Hi-C track type but it can be implemented with a DynamicTrack

```json
{
  "type": "DynamicTrack",
  "trackId": "hic",
  "name": "Hic Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "HicAdapter",
    "hicLocation": {
      "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic"
    }
  },
  "renderer": {
    "type": "HicRenderer"
  }
}
```

### HicAdapter configuration options

- hicLocation - a 'file location' for the a .hic file

Example HicAdapter config

```json
{
  "type": "HicAdapter",
  "hicLocation": { "uri": "http://yourhost/file.hic" }
}
```

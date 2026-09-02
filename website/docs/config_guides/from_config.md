---
title: FromConfig adapters
description:
  Inline data adapters for embedding small datasets directly in config
guide_category: Core configuration
---

**TL;DR:** the FromConfig adapters take their data from an array written into
`config.json`, for small datasets or for features an API handed you. There are
three: `FromConfigAdapter` for features, `FromConfigSequenceAdapter` for
sequence, and `FromConfigRegionsAdapter` for refNames and lengths with no
sequence.

## FromConfigAdapter

Each entry in `features` needs `refName`, `start`, `end` and a unique
`uniqueId`; `type`, `name` and any other attribute are optional and readable
from a [jexl callback](/docs/config_guides/jexl). It works under any feature
track type:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "inline_features",
  "name": "Inline features",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "FromConfigAdapter",
    "features": [
      {
        "refName": "ctgA",
        "uniqueId": "feature1",
        "start": 190,
        "end": 250,
        "type": "gene",
        "name": "MyGene"
      },
      {
        "refName": "ctgA",
        "uniqueId": "feature2",
        "start": 300,
        "end": 400,
        "type": "mRNA",
        "name": "MyTranscript"
      }
    ]
  }
}
```

## FromConfigSequenceAdapter

The sequence adapter of an [assembly](/docs/config_guides/assemblies), with each
feature's `seq` holding the bases for its region:

```json
{
  "name": "inline_assembly",
  "sequence": {
    "adapter": {
      "type": "FromConfigSequenceAdapter",
      "features": [
        {
          "refName": "SEQUENCE_1",
          "uniqueId": "firstId",
          "start": 0,
          "end": 33,
          "seq": "CCAAGATCTAAGATGTCAACACCTATCTGCTCA"
        },
        {
          "refName": "SEQUENCE_2",
          "uniqueId": "secondId",
          "start": 0,
          "end": 44,
          "seq": "CCGAACCACAGGCCTATGTTACCATTGGAAAGCTCACCTTCCCG"
        }
      ]
    }
  }
}
```

## FromConfigRegionsAdapter

Names and lengths with no sequence, so a view can navigate and tracks can draw
against an assembly whose FASTA you do not have or do not want to load. Same
place in the config, and each feature is just an interval:

```json
{
  "name": "regions_only",
  "sequence": {
    "adapter": {
      "type": "FromConfigRegionsAdapter",
      "features": [
        { "uniqueId": "ctgA", "refName": "ctgA", "start": 0, "end": 50000 },
        { "uniqueId": "ctgB", "refName": "ctgB", "start": 0, "end": 6079 }
      ]
    }
  }
}
```

The same thing from a file is a
[`ChromSizesAdapter`](/docs/config/chromsizesadapter) over a `.chrom.sizes`.

## See also

- [Configuring tracks](/docs/config_guides/tracks)
- [Configuring assemblies](/docs/config_guides/assemblies)
- [FromConfigAdapter config docs](/docs/config/fromconfigadapter)

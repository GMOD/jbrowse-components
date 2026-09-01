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

Each entry in `features` is a feature object. `refName`, `start`, `end`, and a
unique `uniqueId` are required. `type`, `name`, and any other attributes are
optional, and any extra attribute is readable from a
[jexl callback](/docs/config_guides/jexl). Use it with any feature track type,
such as a `FeatureTrack`:

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

A `FromConfigAdapter` optimized for sequence features, as the adapter of a
reference sequence track (see
[configuring assemblies](/docs/config_guides/assemblies)); each feature's `seq`
holds the bases for its region:

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

Supplies refNames and their lengths with no sequence, so a view can be navigated
and tracks drawn against an assembly whose FASTA you don't have or don't want to
load. Same place in the config as `FromConfigSequenceAdapter`, and each feature
is just an interval:

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

For the same thing from a file, use a
[`ChromSizesAdapter`](/docs/config/chromsizesadapter) over a `.chrom.sizes`.

## See also

- [Configuring tracks](/docs/config_guides/tracks)
- [Configuring assemblies](/docs/config_guides/assemblies)
- [FromConfigAdapter config docs](/docs/config/fromconfigadapter)

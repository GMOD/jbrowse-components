---
title: FromConfig adapters
description:
  Inline data adapters for embedding small datasets directly in config
guide_category: Callbacks and customization
---

`FromConfigAdapter` and `FromConfigSequenceAdapter` embed feature data directly
in the config rather than reading a file, useful for small datasets or features
returned by an API. Either can be the `adapter` value for any track type.

## FromConfigAdapter

Each entry in `features` is a feature object. `refName`, `start`, `end`, and a
unique `uniqueId` are required. `type`, `name`, and any other attributes are
optional. Use it with any feature track type, such as a `FeatureTrack`:

```json
{
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
```

## FromConfigSequenceAdapter

Like `FromConfigAdapter`, but optimized for sequence features (used by reference
sequence tracks, see [configuring assemblies](/docs/config_guides/assemblies)).

Example `FromConfigSequenceAdapter`:

```json
{
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
```

## See also

- [Configuring tracks](/docs/config_guides/tracks), the track config these
  adapters plug into
- [FromConfigAdapter config docs](/docs/config/fromconfigadapter) and
  [FromConfigSequenceAdapter config docs](/docs/config/fromconfigsequenceadapter),
  the full slot reference

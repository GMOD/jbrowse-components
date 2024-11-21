---
id: from_config
title: FromConfig adapters
---

There are two useful adapter types that can be used for more advanced use cases,
such as generating configuration for data returned by an API. These are the
`FromConfigAdapter` and `FromConfigSequenceAdapter`. They can be used as the
`adapter` value for any track type.

#### FromConfigAdapter

This adapter can be used to generate features directly from values stored in the
configuration.

Example `FromConfigAdapter`:

```json
{
  "type": "FromConfigAdapter",
  "features": [
    {
      "refName": "ctgA",
      "uniqueId": "alias1",
      "aliases": ["A", "contigA"]
    },
    {
      "refName": "ctgB",
      "uniqueId": "alias2",
      "aliases": ["B", "contigB"]
    }
  ]
}
```

#### FromConfigSequenceAdapter

Similar behavior to `FromConfigAdapter`, with a specific emphasis on performance
when the features are sequences.

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

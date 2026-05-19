---
title: Default session
id: default_session
---

A "default session" in `config.json` sets the initial state loaded for all
users. Sessions can be complex to write by hand, so use **File → Export
session** to export the current state, then copy the `"session"` object into
`"defaultSession"` in your `config.json`.

Example exported session (abbreviated):

```json
{
  "session": {
    "id": "eXr4hv4VX",
    "name": "Session",
    "views": [
      {
        "id": "eXr4hv4VX-view",
        "type": "LinearGenomeView",
        "offsetPx": 14500,
        "bpPerPx": 1.7,
        "displayedRegions": [
          {
            "refName": "ctgA",
            "start": 0,
            "end": 50001,
            "reversed": false,
            "assemblyName": "volvox"
          }
        ]
      }
    ]
  }
}
```

In `config.json`:

```json
{
  "assemblies": [
    {
      "name": "volvox",
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "volvox_refseq",
        "adapter": {
          "type": "TwoBitAdapter",
          "twoBitLocation": {
            "uri": "volvox.2bit"
          }
        }
      }
    }
  ],
  "defaultSession": {
    "id": "eXr4hv4VX",
    "name": "Session",
    "views": [
      {
        "id": "eXr4hv4VX-view",
        "type": "LinearGenomeView",
        "offsetPx": 14500,
        "bpPerPx": 1.7,
        "displayedRegions": [
          {
            "refName": "ctgA",
            "start": 0,
            "end": 50001,
            "reversed": false,
            "assemblyName": "volvox"
          }
        ]
      }
    ]
  },
  "tracks": [
    {
      "type": "VariantTrack",
      "trackId": "variants",
      "name": "variants",
      "assemblyNames": ["volvox"],
      "adapter": {
        "type": "VcfTabixAdapter",
        "vcfGzLocation": {
          "uri": "volvox.dup.vcf.gz"
        },
        "index": {
          "location": {
            "uri": "volvox.dup.vcf.gz.tbi"
          }
        }
      }
    }
  ]
}
```

:::info

To configure sessions via URL, see [URL parameters](/docs/urlparams).

:::

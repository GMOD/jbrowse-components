---
title: Default session
id: default_session
---

In JBrowse, a session refers to the particular state of the application e.g. the
views that are open, the tracks that are open, etc.

You can configure a "default session" in the config.json that can be used as the
default application state that is loaded for all your users.

The session is a representation of the 'internal state' of the app, so it can be
hard to programmatically write, but you can manually use the app, get to a state
you want it to be in, and then select "File->Export session". This will give you
a session.json file, and then you can copy the "session" from this file into the
"defaultSession" in your config.json

Example session (reduced for example purposes)

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

Then copy the above into your config.json in the "defaultSession", for example:

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

Note: if you want to programmatically configure sessions using the URL, see
https://jbrowse.org/jb2/docs/urlparams/

:::

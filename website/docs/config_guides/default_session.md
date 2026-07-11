---
title: Default session
description: Setting an initial session state loaded for all users
guide_category: Other features
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
    "views": [ ... same as the exported session above ... ]
  },
  "tracks": [ ... ]
}
```

The `defaultSession` value is exactly the `session` object you exported — copy
it in verbatim.

To configure sessions via URL, see [URL parameters](/docs/urlparams).

## See also

- [Intro to the config.json format](/docs/config_guides/intro) — where
  `defaultSession` sits alongside `assemblies` and `tracks`
- [URL parameters](/docs/urlparams) — passing a session via the URL instead of
  baking one into `config.json`
- [Deploying JBrowse Web](/docs/config_guides/deploying) — scripting the config
  (and its default session) in a pipeline

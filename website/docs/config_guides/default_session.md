---
title: Default session
description: Setting an initial session state loaded for all users
guide_category: Other features
---

A "default session" in `config.json` sets the initial state loaded for all
users. Sessions are tedious to write by hand, so set the view up in the app, use
**File → Export session**, and copy the exported `"session"` object in as
`"defaultSession"`.

A complete `config.json` that opens on a region of `ctgA` with the genes track
already showing:

```json
{
  "assemblies": [{ "name": "volvox", "uri": "volvox.2bit" }],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "volvox_genes",
      "name": "Genes",
      "assemblyNames": ["volvox"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "uri": "volvox.sort.gff3.gz"
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
        ],
        "tracks": [
          {
            "id": "volvox_genes-track",
            "type": "FeatureTrack",
            "configuration": "volvox_genes",
            "displays": [
              {
                "id": "volvox_genes-display",
                "type": "LinearBasicDisplay",
                "configuration": "volvox_genes-LinearBasicDisplay"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Note how the session's track entry refers back to the top-level track by
`trackId` through its `configuration` field, rather than repeating the adapter.

Any track opened in the default session must also be defined in the top-level
`tracks` array (or by the assembly), so the session can resolve it by `trackId`.
A session that references a track missing from the config will fail to open that
track.

To configure sessions via URL, see [URL parameters](/docs/urlparams).

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [URL parameters](/docs/urlparams)
- [Deploying JBrowse Web](/docs/config_guides/deploying)

---
title: Default session
description:
  Setting the initial session state loaded for all users, and shipping named
  sessions users can switch between
guide_category: Appearance
---

**TL;DR:** a `defaultSession` in `config.json` sets the initial state loaded for
all users. Don't write one by hand. Set the view up in the app, use its export
session option, and paste the exported `"session"` object in as
`"defaultSession"`. URL params like `&session=` and `&loc=` build a fresh
session and ignore the `defaultSession`, unless
[`&extendSession=true`](/docs/urlparams#navigating-within-the-default-session)
is set, which navigates within it while keeping its tracks and settings.

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

The session's track entry refers back to the top-level track by `trackId`
through its `configuration` field rather than repeating the adapter.

That indirection is also what most often breaks. Any track the session opens
must exist in the top-level `tracks` array (or come from the assembly), or the
session silently fails to open it. If a pipeline regenerates `config.json` with
different `trackId`s each build, the `defaultSession` breaks along with every
previously shared link, which is why
[trackIds must stay stable](/docs/config_guides/deploying#keep-trackids-stable-for-reproducible-links).

To configure sessions via URL, see [URL parameters](/docs/urlparams).

## Shipping several named sessions

[`preConfiguredSessions`](/docs/config/jbrowserootconfig/#slot-preconfiguredsessions)
is a top-level array of the same session objects, each with a `name`, which
jbrowse-web and jbrowse-desktop list under File → "Pre-configured sessions...".
Use it where one instance serves several starting points — a figure per
publication, a locus per assay — that a reader should be able to switch between
without a link.

```json
{
  "defaultSession": { "name": "Overview", "views": [] },
  "preConfiguredSessions": [
    { "name": "LCT haplotype", "views": [] },
    { "name": "MHC region", "views": [] }
  ]
}
```

They are the same format as `defaultSession`, so build each one the same way:
set the view up in the app, export the session, paste the exported object in
with a `name`. The same `trackId` caveat applies — a session naming a track that
is not in the top-level `tracks` array silently opens without it.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [URL parameters](/docs/urlparams)
- [](/docs/config_guides/deploying)

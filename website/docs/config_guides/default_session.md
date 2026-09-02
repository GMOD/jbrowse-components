---
title: Default session
description:
  Setting the initial session state loaded for all users, and shipping named
  sessions users can switch between
guide_category: Appearance
---

**TL;DR:** a `defaultSession` in `config.json` sets the initial state loaded for
all users. Give each view an assembly, a location and the tracks to open — three
lines you can write by hand or emit from a script. URL params like `&session=`
and `&loc=` build a fresh session and ignore the `defaultSession`, unless
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
    "name": "Session",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "volvox",
        "loc": "ctgA:1-50000",
        "tracks": ["volvox_genes"]
      }
    ]
  }
}
```

`assembly` and `loc` are resolved when the view attaches. [](/docs/automating)
lists every field a view takes (`grow`, `highlight`, `tracklist`, `nav`,
`displayedRegionNames`), and other view settings go on the same object
(`colorByCDS`, `showAminoAcids`, `showCenterLine`, `trackLabels`).

A track entry can be an object when it needs display options:
`{ "trackId": "volvox_genes", "height": 200 }`. Any slot the display defines can
be set this way.

## Referencing tracks by trackId

A view's `tracks` lists `trackId`s from the top-level `tracks` array. A track
missing from that array is silently not opened, which `jbrowse validate`
reports. A pipeline that changes `trackId`s each build breaks the
`defaultSession` along with every shared link, so
[trackIds must stay stable](/docs/config_guides/deploying#keep-trackids-stable-for-reproducible-links).

To configure sessions via URL, see [URL parameters](/docs/urlparams).

## Sessions the app exports

The app's export-session option writes a full state snapshot (`id`s,
`displayedRegions`, the window, and a `displays` array per track). It pastes
straight in as a `defaultSession`, but is long to hand-edit: every coordinate is
resolved, and a display node accepts only that display's state-model properties,
so `"height": 250` written there is dropped without warning. Use an export to
capture a view built by clicking, and read the locus and track ids off it into a
hand-written view.

## Shipping several named sessions

[`preConfiguredSessions`](/docs/config/jbrowserootconfig/#slot-preconfiguredsessions)
is a top-level array of the same session objects, each with a `name`, listed
under File → "Pre-configured sessions..." in jbrowse-web and jbrowse-desktop.

```json
{
  "defaultSession": { "name": "Overview", "views": [] },
  "preConfiguredSessions": [
    { "name": "LCT haplotype", "views": [] },
    { "name": "MHC region", "views": [] }
  ]
}
```

The same `trackId` caveat applies: a session naming a track not in the top-level
`tracks` array silently opens without it.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [URL parameters](/docs/urlparams)
- [](/docs/config_guides/deploying)

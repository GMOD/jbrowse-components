---
title: Default session
description:
  Setting the initial session state loaded for all users, and shipping named
  sessions users can switch between
guide_category: Appearance
---

**TL;DR:** a `defaultSession` in `config.json` sets the initial state loaded for
all users. Give each view an assembly, a location and the tracks to open, three
lines you can write by hand or emit from a script. URL params like `&session=`
and `&loc=` build a fresh session and ignore the `defaultSession`, unless
[`&extendSession=true`](/docs/urlparams#navigating-within-the-default-session)
is set, which navigates within it while keeping its tracks and settings.

A session that opens on a region of `ctgA` with the `volvox_genes` track from
the config's `tracks` array already showing:

```json session
{
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

- `assembly` and `loc` resolve when the view attaches. [](/docs/automating)
  lists every field a view takes (`grow`, `highlight`, `tracklist`, `nav`,
  `displayedRegionNames` for a whole-genome view of chosen chromosomes) and the
  view settings that go on the same object.
- **A track entry can be an object** when it needs a display option:
  `{ "trackId": "volvox_genes", "height": 200 }` opens the track at that height,
  and any slot the display defines works there.

## Referencing tracks by trackId

A view's `tracks` names `trackId`s from the top-level `tracks` array; the
session never repeats an adapter. A track missing from that array (or from the
assembly) silently fails to open, which is what `jbrowse validate` reports, and
why a pipeline that regenerates `config.json` must
[keep trackIds stable](/docs/config_guides/deploying#keep-trackids-stable-for-reproducible-links).

## Sessions the app exports

The app's export-session option writes a full state snapshot with every
coordinate resolved and each track carrying a `configuration` reference and a
`displays` array. It pastes straight in as a `defaultSession`, and a config slot
written on one of its display nodes (`"height": 250`) is dropped without
warning, where the same key works in a track entry the view opens by id
([what a view takes](/docs/automating#what-a-view-takes)). Use an export to
capture a view built by clicking, and read the locus and track ids off it into a
hand-written view for anything you keep editing.

## Shipping several named sessions

[`preConfiguredSessions`](/docs/config/jbrowserootconfig/#slot-preconfiguredsessions)
is a top-level array of the same session objects, each with a `name`, listed
under File → "Pre-configured sessions..." in jbrowse-web and jbrowse-desktop.
One instance can then serve a figure per publication or a locus per assay, and a
reader switches without a link:

```json
{
  "defaultSession": { "name": "Overview", "views": [] },
  "preConfiguredSessions": [
    { "name": "LCT haplotype", "views": [] },
    { "name": "MHC region", "views": [] }
  ]
}
```

The same `trackId` rule applies: a session naming a track outside the top-level
`tracks` array opens without it.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [URL parameters](/docs/urlparams)
- [](/docs/config_guides/deploying)

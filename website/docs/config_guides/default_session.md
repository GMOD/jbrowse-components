---
title: Default session
description:
  Setting the initial session state loaded for all users, and shipping named
  sessions users can switch between
guide_category: Appearance
---

**TL;DR:** a `defaultSession` in `config.json` sets the initial state loaded for
all users. Give each view an `init` block naming an assembly, a location and the
tracks to open — three lines you can write by hand or emit from a script. URL
params like `&session=` and `&loc=` build a fresh session and ignore the
`defaultSession`, unless
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
        "init": {
          "assembly": "volvox",
          "loc": "ctgA:1-50000",
          "tracks": ["volvox_genes"]
        }
      }
    ]
  }
}
```

`init` is resolved when the view attaches: it works out the `displayedRegions`,
`bpPerPx` and `offsetPx` that the locus implies, so you never write coordinates
in pixels. [](/docs/automating) lists every field it takes — `grow` to pad the
locus for context, `highlight`, `tracklist`, `nav`, and `displayedRegionNames`
to open a whole-genome view of selected chromosomes.

A track entry can be an object rather than a string when it needs display
options: `{ "trackId": "volvox_genes", "height": 200 }` opens the track 200px
tall. Any slot the display defines can be set this way.

View settings that are not about launching — `colorByCDS`, `showAminoAcids`,
`showCenterLine`, `trackLabels` — are properties of the view itself, so they sit
_beside_ `init` rather than inside it:

```json
{
  "defaultSession": {
    "name": "Session",
    "views": [
      {
        "type": "LinearGenomeView",
        "colorByCDS": true,
        "init": { "assembly": "volvox", "loc": "ctgA:1-50000" }
      }
    ]
  }
}
```

## Tracks are named, not repeated

`init.tracks` lists `trackId`s from the top-level `tracks` array; the session
never repeats an adapter. That indirection is what most often breaks. Any track
the session opens must exist in the top-level `tracks` array (or come from the
assembly), or the session silently fails to open it. If a pipeline regenerates
`config.json` with different `trackId`s each build, the `defaultSession` breaks
along with every previously shared link, which is why
[trackIds must stay stable](/docs/config_guides/deploying#keep-trackids-stable-for-reproducible-links).

`jbrowse validate` reports a `defaultSession` naming a `trackId` that does not
exist, which is the cheapest way to catch this in a build.

To configure sessions via URL, see [URL parameters](/docs/urlparams).

## Sessions the app exports

The app's export-session option writes a different shape: a full state snapshot
with `id`s, `displayedRegions`, `bpPerPx` and `offsetPx` spelled out, and each
track carrying a `configuration` reference and a `displays` array. It is valid
as a `defaultSession` and pastes straight in.

Two things to know before doing that. It is long, and every coordinate in it is
resolved, so re-aiming the view means editing pixel offsets rather than a
locstring. And a snapshot's display node accepts only that display's state-model
properties, so a config slot written there — `"height": 250` on the display — is
dropped without warning, where the same key works in an `init` track entry.

So reach for an export when you want to capture a view you built by clicking,
and read the locus and track ids off it into an `init` block for anything you
intend to keep editing.

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

They are the same format as `defaultSession`, so each one is a `name` and a list
of views with `init` blocks — which makes a set of them cheap to generate from
whatever already knows the loci. The same `trackId` caveat applies: a session
naming a track that is not in the top-level `tracks` array silently opens
without it.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [URL parameters](/docs/urlparams)
- [](/docs/config_guides/deploying)

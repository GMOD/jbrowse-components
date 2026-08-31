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

`assembly` and `loc` are resolved when the view attaches, which works out the
`displayedRegions` and the window the locus implies. [](/docs/automating) lists
every field a view takes — `grow` to pad the locus for context, `highlight`,
`tracklist`, `nav`, and `displayedRegionNames` to open a whole-genome view of
selected chromosomes. Every other view setting goes on the same object:
`colorByCDS`, `showAminoAcids`, `showCenterLine`, `trackLabels`.

A track entry can be an object when it needs display options:
`{ "trackId": "volvox_genes", "height": 200 }` opens the track 200px tall. Any
slot the display defines can be set this way.

## Referencing tracks by trackId

A view's `tracks` lists `trackId`s from the top-level `tracks` array; the
session never repeats an adapter. Any track the session opens must exist in that
array (or come from the assembly), or the session silently fails to open it. If
a pipeline regenerates `config.json` with different `trackId`s each build, the
`defaultSession` breaks along with every previously shared link, which is why
[trackIds must stay stable](/docs/config_guides/deploying#keep-trackids-stable-for-reproducible-links).

`jbrowse validate` reports a `defaultSession` naming a `trackId` that does not
exist.

To configure sessions via URL, see [URL parameters](/docs/urlparams).

## Sessions the app exports

The app's export-session option writes a full state snapshot: `id`s,
`displayedRegions` and the window (`windowStartBp`, `windowWidthBp`) spelled
out, and each track carrying a `configuration` reference and a `displays` array.
It is valid as a `defaultSession` and pastes straight in.

It is long, and hand-editing it comes with caveats:

- Every coordinate is resolved, so re-aiming the view means editing base-pair
  offsets.
- A display node accepts only that display's state-model properties, so a config
  slot written there — `"height": 250` on the display — is dropped without
  warning, where the same key works in a track entry the view opens by id.

Use an export to capture a view you built by clicking, and read the locus and
track ids off it into a hand-written view for anything you intend to keep
editing.

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

They are the same format as `defaultSession`: a `name` and a list of views, so a
set of them is cheap to generate from whatever already knows the loci. The same
`trackId` caveat applies: a session naming a track that is not in the top-level
`tracks` array silently opens without it.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [URL parameters](/docs/urlparams)
- [](/docs/config_guides/deploying)

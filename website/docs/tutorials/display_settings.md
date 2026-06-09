---
title: Applying display settings
description:
  Set track display settings via config.json, URL, or embedded session
guide_category: Tutorials
---

Track display settings — height, color scheme, display type, score range, and so
on — live in two places:

- **Persistent defaults** in `config.json`, on the track's `displays` array.
  These apply every time the track opens, in every session.
- **Per-session snapshots** via a `displaySnapshot` object in a session spec.
  These set the track's _initial_ state when a particular link or embedded view
  loads, and override the `config.json` defaults.

Both use the same setting names. A `displaySnapshot` is a runtime override of
the same fields you can bake in as defaults with `displays`. This tutorial shows
the three contexts in which you set them.

## Finding a setting's name

The keys inside `displays` and `displaySnapshot` match the display model's own
settings. Two ways to discover them:

- Configure the track interactively (height, color scheme, etc.), then use the
  **Share** button to generate a session link — the spec it produces contains
  the exact `displaySnapshot` keys for everything you changed.
- Look up the display in the auto-generated
  [config schema docs](/docs/config_guide) (e.g.
  [LinearWiggleDisplay](/docs/config/linearwiggledisplay),
  [LinearPileupDisplay](/docs/config/linearpileupdisplay)).

Common keys include `type` (the display type), `height`, `minScore` /
`maxScore`, `defaultRendering`, `showSoftClipping`, and `colorBy`.

## In config.json (persistent defaults)

Nest a display entry in the track's `displays` array. It applies whenever the
track is shown:

```json
{
  "type": "QuantitativeTrack",
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "BigWigAdapter", "uri": "http://yourhost/file.bw" },
  "displays": [
    {
      "type": "LinearWiggleDisplay",
      "defaultRendering": "line",
      "minScore": 0,
      "maxScore": 100
    }
  ]
}
```

See [configuring tracks](/docs/config_guides/tracks) for more on the `displays`
array.

## In a URL (session spec)

A `?session=spec-{...}` URL can open tracks with an initial `displaySnapshot`.
Each entry in a view's `tracks` array is either a plain `trackId` string or an
object carrying a snapshot:

```json
{
  "views": [
    {
      "assembly": "volvox",
      "loc": "ctgA:1-10000",
      "type": "LinearGenomeView",
      "tracks": [
        {
          "trackId": "volvox_sv_cram",
          "displaySnapshot": {
            "height": 250,
            "showSoftClipping": true,
            "colorBy": { "type": "pairOrientation" }
          }
        }
      ]
    }
  ]
}
```

URL-encoded onto the end of a JBrowse link:

```
?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-10000","type":"LinearGenomeView","tracks":[{"trackId":"volvox_sv_cram","displaySnapshot":{"height":250,"showSoftClipping":true,"colorBy":{"type":"pairOrientation"}}}]}]}
```

See [URL parameters](/docs/urlparams) for the full session-spec format,
including `trackSnapshot` and multi-view specs.

## In an embedded component

The embedded React components take the same shape through
`defaultSession.view.init.tracks`. Pass snapshot objects to set each track's
startup state:

```js
import {
  useCreateViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'

function GenomeBrowser() {
  const state = useCreateViewState({
    assembly,
    tracks,
    defaultSession: {
      name: 'Wiggle display config',
      view: {
        type: 'LinearGenomeView',
        init: {
          loc: 'ctgA:1105..3000',
          assembly: 'volvox',
          tracks: [
            {
              trackId: 'volvox_microarray',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'line',
                height: 150,
              },
            },
          ],
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
```

See [embedding the linear genome view](/docs/tutorials/embed_linear_genome_view)
for the full embedded setup.

## Which wins?

When both are present, the `displaySnapshot` overrides the `config.json`
defaults for that session. Use `displays` for settings everyone should always
get, and `displaySnapshot` for a link or embedded view that should open in a
specific state.

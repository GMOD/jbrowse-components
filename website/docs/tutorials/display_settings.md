---
title: Display settings
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

Both use the same setting names — a `displaySnapshot` is just a per-session
override of the fields you can bake in as defaults with `displays`. This
tutorial shows the three places you set them.

## Finding a setting's name

The keys inside `displays` and `displaySnapshot` match the display model's own
settings. Two ways to discover them:

- Configure the track interactively (height, color scheme, etc.), then use the
  **Share** button to generate a session link — the spec it produces contains
  the exact `displaySnapshot` keys for everything you changed.
- Look up the display in the auto-generated
  [config schema docs](/docs/config_guide) (e.g.
  [LinearWiggleDisplay](/docs/config/linearwiggledisplay),
  [LinearAlignmentsDisplay](/docs/config/linearalignmentsdisplay)).

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
            "linkedReads": "normal",
            "colorBy": { "type": "insertSizeAndOrientation" }
          }
        }
      ]
    }
  ]
}
```

URL-encoded onto the end of a JBrowse link:

```
?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-10000","type":"LinearGenomeView","tracks":[{"trackId":"volvox_sv_cram","displaySnapshot":{"height":250,"showSoftClipping":true,"linkedReads":"normal","colorBy":{"type":"insertSizeAndOrientation"}}}]}]}
```

<Figure caption="What that link opens: the volvox-sv (cram) track at ctgA:1–10,000 with the displaySnapshot applied — a 250px-tall pileup, soft-clipping shown, and reads viewed as pairs, so each read links to its mate and is colored by insert size and orientation. The colored cluster at the left flags a structural variant, while concordant pairs stay grey." src="/img/display_settings_url_snapshot.png" />

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

## See also

- [Configuring tracks](/docs/config_guides/tracks) — the full `displays` array
  and other track config
- [URL parameters](/docs/urlparams) — the session-spec format, including
  `trackSnapshot` and multi-view specs
- [Embedding JBrowse](/docs/tutorials/embed_linear_genome_view) — passing
  snapshots through an embedded component
- [Config schema docs](/docs/config_guide) — every display type's settable keys

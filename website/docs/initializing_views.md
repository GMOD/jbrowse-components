---
title: Initializing and launching views
---

There is **one concept** for telling a view what to show when it opens: a
declarative `init` spec. The same set of fields — assembly, location, tracks,
track selector, header, highlights — is used everywhere a view is launched,
whether from a URL, an embedded component, or a config/session file. This page
explains that one concept and points you to the detailed reference for whichever
surface you are using.

## The `init` fields

```typescript
{
  assembly: string        // required: assembly name
  loc?: string            // initial location, e.g. 'chr1:1,000-2,000'
                          //   (omit to show the whole genome)
  tracks?: TrackInit[]    // tracks to open (id strings, or objects — see below)
  tracklist?: boolean     // open the track selector drawer (default: false)
  nav?: boolean           // show the navigation header (default: true)
  highlight?: string[]    // regions to highlight
}
```

A `TrackInit` is either a track id string, or an object that also sets initial
display options:

```typescript
{
  trackId: string
  trackSnapshot?: object   // overrides on the track
  displaySnapshot?: object // overrides on the display, e.g. { height: 250 }
}
```

`init` is applied **once**, when the view attaches, and then cleared — it is a
launch instruction, not persistent state, so a saved session never retains it.

## Which launch method should I use?

| You are…                                  | Use                                            | Reference                                                     |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Linking to JBrowse Web with a location    | **URL query parameters**                       | [URL query parameter API](/docs/urlparams)                    |
| Embedding a view in your own web page/app | **`createViewState({ location, … })`**         | [Embedding JBrowse](/docs/tutorials/embed_linear_genome_view) |
| Shipping a preset view in a config file   | **`defaultSession`** in config.json            | [Default session](/docs/config_guides/default_session)        |
| Programmatically opening a preset session | **a session spec** (`init` in a view snapshot) | [URL params → session spec](/docs/urlparams)                  |

All four resolve to the same `init` fields above and run the same code path, so
behavior (navigation, track opening, highlighting, the loading spinner) is
identical regardless of how you launched.

## URL parameters

JBrowse Web maps query parameters straight onto `init`:

```
?assembly=hg19&loc=chr1:1,000-2,000&tracks=genes,variants&tracklist=true&nav=false&highlight=chr1:1,500-1,600
```

See [URL query parameter API](/docs/urlparams) for every parameter, session
specs for all view types, and shareable/encoded sessions.

:::info note

Embedded components (`@jbrowse/react-linear-genome-view2`,
`@jbrowse/react-app2`) make no assumptions about URL parameters — that logic is
up to the host application.

:::

## Embedded components (`createViewState`)

`createViewState` accepts `location` and `highlight` and routes them through
`init`, so an embedded view shows the loading spinner (not the import form)
while the assembly loads:

```js
const state = createViewState({
  assembly,
  tracks,
  location: 'chr1:1,000-2,000',
  highlight: ['chr1:1,500-1,600'],
})
```

For full track control at launch, provide a `defaultSession` whose view carries
an `init` object. See
[Embedding JBrowse](/docs/tutorials/embed_linear_genome_view) and
[Drawer widgets](/docs/developer_guides/drawer_widgets).

## Config / session files

A `defaultSession` in config.json (or any session snapshot) can give a view an
`init` block:

```json
{
  "defaultSession": {
    "name": "My session",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "hg19",
          "loc": "chr1:1,000,000-2,000,000",
          "tracks": ["genes", "variants"]
        }
      }
    ]
  }
}
```

See [Default session](/docs/config_guides/default_session).

## Highlights

A `highlight` entry can be a plain locstring (`chr1:1,000-2,000`) or, when you
need a custom color or label, a JSON object:

```
{"refName":"chr1","start":1000,"end":2000,"color":"#ff000055","label":"my region"}
```

In a URL, `highlight` is space-separated and the JSON form must not contain
spaces (a space inside a label is split apart); the JSON form is most reliable
for programmatic `createViewState`/session-JSON launches. See the
[`&highlight=` reference](/docs/urlparams) for details.

## Other view types

Circular, dotplot, synteny, spreadsheet, breakpoint-split, and SV-inspector
views each accept their own `init`/session-spec shape with the same
"applied-once-on-launch" lifecycle. Their fields are documented per view type in
the [URL query parameter API](/docs/urlparams) session-spec section.

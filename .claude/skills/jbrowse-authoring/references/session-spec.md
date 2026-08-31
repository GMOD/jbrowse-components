# The session spec

One description of "what should be open", accepted through four different doors.
Every door takes the same view object, so what you learn once applies
everywhere.

Canonical docs: <https://jbrowse.org/jb2/docs/automating.md> and
<https://jbrowse.org/jb2/docs/urlparams.md>.

## What a view opens onto

Every setting goes directly on the view object, on every door below.

```typescript
{
  assembly: string          // required
  loc?: string              // 'chr1:1,000-2,000'; omit for a whole-genome view
  grow?: number             // pad around loc for context — 0.2 adds 20% each side
  displayedRegionNames?: string[]  // with no loc, restrict + order the chromosomes
  tracks?: TrackInit[]      // tracks to open
  tracklist?: boolean       // open the track selector drawer (default false)
  nav?: boolean             // show the navigation header (default true)
  highlight?: string[]      // regions to highlight
}
```

A `TrackInit` is a `trackId` string, or an object that also sets initial state:

```typescript
{
  trackId: string
  trackSnapshot?: object     // overrides on the track
  displaySnapshot?: object   // overrides on the display, e.g. { height: 250 }
}
```

`displaySnapshot` is how you set a per-track height or color at launch — those
live on the _display_, not the track, and a menu can't reach them before the
view exists.

These fields are applied once when the view attaches and then cleared. They are
launch instructions rather than persistent state, so a saved session never
carries them.

## Door 1 — `defaultSession` in a config file

```json
{
  "assemblies": [ ... ],
  "tracks": [ ... ],
  "defaultSession": {
    "name": "demo",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr1:1-100000",
        "tracks": ["my_track"]
      }
    ]
  }
}
```

The route to use when you are authoring the config anyway. Works identically in
desktop (`jbrowse-desktop config.json`) and web (`?config=config.json`).

## Door 2 — a session spec in a URL

```
?config=<config url>&session=spec-<uri-encoded JSON>&sessionName=<name>
```

The JSON is the session, not the config:

```json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "hg38",
      "loc": "chr1:1-100000",
      "tracks": ["my_track"]
    }
  ],
  "sessionAssemblies": [],
  "sessionTracks": [],
  "layout": {}
}
```

Top-level keys:

| key                 | meaning                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| `views`             | the views to open; each needs `type`, plus the fields above                       |
| `sessionAssemblies` | assemblies defined by the spec itself — with these, no `config=` is needed at all |
| `sessionTracks`     | tracks defined by the spec, for data not in the config                            |
| `layout`            | workspace arrangement (see below)                                                 |
| `sessionName`       | name for the session                                                              |

`sessionAssemblies` + `sessionTracks` are what let a link carry data the hosted
config has never heard of — the route for showing someone your own file on a
public JBrowse instance.

A `sessionTracks` entry can be `{ "trackId", "uri", "assemblyNames" }`, which
keeps the link short — the type and adapter come from the file's extension.
`assemblyNames` is required here: the implied assembly comes from a config
file's own `assemblies`, and a session track with none gets an empty list and
belongs to no assembly.

Encoding is `spec-` + `encodeURIComponent(JSON.stringify(session))`.

## Door 3 — desktop, from a link

Desktop consumes the exact same web URL, wrapped:

```
jbrowse://open?url=<uri-encoded JBrowse Web url>
```

Desktop parses the link, loads the config it names, and runs the same
`loadSessionSpec`. Only `http(s)` inner URLs are accepted, and the user gets a
confirmation dialog naming the destination — it is a native dialog, so this
route is human-in-the-loop by construction and cannot be driven headlessly.

## Door 4 — embedded

`createViewState({ config, location, ... })` in `@jbrowse/react-app2` and the
other embedded products takes the same fields as props. See
<https://jbrowse.org/jb2/docs/embedded_components.md>.

## Multi-view layouts

`layout` arranges views into panels. Its `views` entries are **indices into the
spec's `views` array**, not ids:

```json
{
  "direction": "horizontal",
  "children": [
    { "views": [0, 1], "size": 70 },
    { "views": [2], "size": 30 }
  ]
}
```

`direction` is `horizontal`, `vertical`, or `tabs` (stack into one tab group
instead of splitting space). `children` nest, and **`size` applies at every
depth** — a nested container takes a share of its parent and divides its own
space among its children.

`size` is a proportion, not a strict percentage: `7`/`3` and `70`/`30` are the
same split. A panel left unsized takes an equal share of what the sized ones
leave over, so `70` beside a bare panel is 70/30.

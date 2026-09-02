---
title: Embedded components
description:
  Which React component to use to put a JBrowse view in your own app, and where
  to find working examples and demos for each
---

The embedded components are **React components** on npm: one JSX element puts a
genome browser in your page. They are the same views the full app is built from,
so a track config that works there works here.

React 18 or newer is the only peer dependency. For a page that isn't a React
app, a `<script>` bundle carries its own React; see
[non-React hosts](#non-react-hosts).

## Choosing a package

| Goal                                              | Package                                                                                                                                                      | Component              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| One linear genome view                            | [`@jbrowse/react-linear-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view2), [examples](https://jbrowse.org/storybook/lgv/)     | `<LinearGenomeView>`   |
| One circular genome view (e.g. SV chord diagrams) | [`@jbrowse/react-circular-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-circular-genome-view2), [examples](https://jbrowse.org/storybook/cgv/) | `<CircularGenomeView>` |
| Complete app (multiple view types, synteny, etc)  | [`@jbrowse/react-app2`](https://www.npmjs.com/package/@jbrowse/react-app2), [examples](https://jbrowse.org/storybook/app/)                                   | `<JBrowse>`            |
| Make your own custom UI around the engine         | `createViewState` + [`@jbrowse/display-ui`](https://www.npmjs.com/package/@jbrowse/display-ui), [examples](https://jbrowse.org/storybook/byo/)               | —                      |

Each package's storybook is the reference: copy-pasteable React code, one page
per task (setting up the view, navigating from your own code, running a worker,
theming, plugins).

A `tracks` entry is a track config, and the shortest one is `{ trackId, uri }`.
The type and adapter come from the file's extension, and `assemblyNames` from
the component's one `assembly` (see
[the shortest track](/docs/config_guides/tracks#the-shortest-track)).

**`@jbrowse/react-app2` also needs its stylesheet**:
`import '@jbrowse/react-app2/styles.css'`. Without it the panels, tabs and
dividers render unstyled.

**The props are initial values, like an input's `defaultValue`.** The engine is
built once on first render and later prop changes are ignored. To switch
`assembly` or plugins on a mounted component, give it a React `key` that changes
with them so React remounts it.

## Embedded views versus the full app

Embedded views are for genome browsing inside an existing page. For a standalone
browser, run [JBrowse Web](/docs/quickstart_web). `@jbrowse/react-app2` sits
between: the whole app as a React component.

|                | Single-view components (LGV, CGV) | `@jbrowse/react-app2`                      | JBrowse Web                                                      |
| -------------- | --------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| View types     | One only                          | All of them, plugins included              | All of them, plugins included                                    |
| Feature detail | Opens in a dialog                 | Opens in a drawer                          | Opens in a left/right oriented drawer                            |
| Sessions       | No built-in saving or loading     | Held in your app's state, yours to persist | Save, import, export, plus local autosave                        |
| URLs           | The page owns the URL             | The page owns the URL                      | Reads [URL params](/docs/urlparams) like `&loc=` and `&session=` |

Sessions and track manipulation are left to the embedding application. For
Python or R, [](/docs/jbrowse_anywidget) and [](/docs/jbrowser) wrap the same
views.

## Non-React hosts

Every package also exports an imperative controller — `createLinearGenomeView`,
`createCircularGenomeView`, `createApp` — with no JSX and no React root for you
to manage. It's what the [Python anywidget](/docs/jbrowse_anywidget), R
htmlwidgets, and plain `<script>` pages are built on. See the vanillajs rows in
[bundler examples](#bundler-examples) below for a working reference
implementation of each.

## Driving it from your code

`createViewState` takes the same view fields a config or a link does
([](/docs/automating#what-a-view-takes)), and routes `location` and `highlight`
through the same launch path, so an embedded view shows the loading spinner
while the assembly loads:

```js
const state = createViewState({
  assembly,
  tracks,
  location: 'chr1:1,000-2,000',
  highlight: ['chr1:1,500-1,600'],
})
```

- **Full track control at launch** is a `defaultSession` whose view names its
  tracks ([](/docs/tutorials/embed_linear_genome_view)).
- **`localFiles`**, a `name -> bytes` map, serves a host whose data lives in a
  process rather than at a URL: a notebook kernel, an R session, anywhere with
  no web server and no CORS. `tracks` then refers to a registered name as if it
  were a URL. Register an index under its conventional sibling name
  (`peaks.bed.gz` + `peaks.bed.gz.tbi`) and only the bytes the view needs are
  read.
- **`menuBar`** draws the app-shaped `File` menu bar above the embedded linear
  view, with the two items an embed can honour (open track, open connection);
  **`disableAddTracks`** empties that menu and removes the track selector's
  add-track affordances. Both are off by default. `height` sets the view's
  height; it supersedes the older `drawerViewHeight`, which only applied while a
  drawer was open.
- **The imperative controllers take callbacks** in place of props:
  `onLocationChange` fires with the visible region as the user pans or zooms,
  `onFeatureSelect` with the clicked feature, `onSessionChange` with the view's
  layout whenever it settles (for a host offering "save this view"), and
  `onError` when the build itself fails, since building is asynchronous and that
  throw cannot reach your own call. `createApp`'s `onPluginsUpdated` fires when
  something changes the running plugin set, with what a rebuild needs to remount
  the app on the new set.

## Bundler examples

| Package                              | Bundler   | Demo                                            | Source                                                                              |
| ------------------------------------ | --------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| @jbrowse/react-app2                  | next.js   | [demo](https://jbrowse.org/demos/app-nextjs)    | [source](https://github.com/GMOD/jbrowse-react-app-nextjs-demo)                     |
| @jbrowse/react-app2                  | vite      | [demo](https://jbrowse.org/demos/app-vite)      | [source](https://github.com/GMOD/jbrowse-react-app-vite-demo)                       |
| @jbrowse/react-app2                  | rsbuild   | [demo](https://jbrowse.org/demos/app-rsbuild)   | [source](https://github.com/GMOD/jbrowse-react-app-rsbuild-demo)                    |
| @jbrowse/react-app2                  | vanillajs | [demo](https://jbrowse.org/demos/app-vanillajs) | [source](https://github.com/GMOD/jbrowse-react-app-vanillajs-demo)                  |
| @jbrowse/react-linear-genome-view2   | vite      | [demo](https://jbrowse.org/demos/lgv-vite)      | [source](https://github.com/GMOD/jbrowse-react-linear-genome-view-vite-demo)        |
| @jbrowse/react-linear-genome-view2   | rsbuild   | [demo](https://jbrowse.org/demos/lgv-rsbuild)   | [source](https://github.com/GMOD/jbrowse-react-linear-genome-view-rsbuild-demo)     |
| @jbrowse/react-linear-genome-view2   | next.js   | [demo](https://jbrowse.org/demos/lgv-nextjs)    | [source](https://github.com/GMOD/jbrowse-react-linear-genome-view-nextjs-demo)      |
| @jbrowse/react-linear-genome-view2   | vanillajs | [demo](https://jbrowse.org/demos/lgv-vanillajs) | [source](https://github.com/GMOD/jbrowse-react-linear-genome-view-vanillajs-demo)   |
| @jbrowse/react-circular-genome-view2 | vanillajs | [demo](https://jbrowse.org/demos/cgv-vanillajs) | [source](https://github.com/GMOD/jbrowse-react-circular-genome-view-vanillajs-demo) |
| @jbrowse/react-circular-genome-view2 | next.js   | [demo](https://jbrowse.org/demos/cgv-nextjs)    | [source](https://github.com/GMOD/jbrowse-react-circular-genome-view-nextjs-demo)    |

## See also

- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/jbrowse_anywidget): Python equivalent
- [](/docs/jbrowser): R/Shiny equivalent

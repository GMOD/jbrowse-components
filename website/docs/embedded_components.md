---
title: Embedded components
description:
  Which React component to use to put a JBrowse view in your own app, and where
  to find working examples and demos for each
---

The embedded components are **React components** on npm: one JSX element puts a
genome browser in your page. They are the same views the full app is built from,
so a track config that works there works here.

React 19 or newer is the only peer dependency. For a page that isn't a React
app, a `<script>` bundle includes its own React; see
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

**`@jbrowse/react-app2` has a stylesheet to import**:
`import '@jbrowse/react-app2/styles.css'`. The stylesheet holds no rules today,
and the package ships any future CSS in it.

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
to manage. The [Python anywidget](/docs/jbrowse_anywidget), R htmlwidgets, and
plain `<script>` pages are built on these controllers. See the vanillajs rows in
[bundler examples](#bundler-examples) below for a working reference
implementation of each.

## Driving it from your code

`createViewState` takes the view to open as `view`, written with the same fields
a config or a link uses ([](/docs/automating#what-a-view-takes)): where it opens
and which tracks it shows, with any of the view's own settings beside them. An
embedded view shows the loading spinner while the assembly loads:

```js
const state = createViewState({
  assembly,
  tracks,
  view: {
    loc: 'chr1:1,000-2,000',
    tracks: ['genes'],
    highlight: ['chr1:1,500-1,600'],
    hideHeader: true,
  },
})
```

- **`location` and `highlight`** are shorthands for `view.loc` and
  `view.highlight`, and the only two that also apply over a `defaultSession` or
  a restored `session`. `view` is the default session's view, so it excludes
  `defaultSession` ([](/docs/tutorials/embed_linear_genome_view)).
- **`jbrowseHub: 'hg38'`** in place of `assembly` fetches that genome from
  [genomes.jbrowse.org](https://genomes.jbrowse.org): its sequence, refName
  aliases, track catalog and gene-name search, so `view: { loc: 'BRCA1' }` works
  and `tracks` adds your own files beside the hosted ones. Any UCSC database
  name or GenArk accession resolves. It is fetched, so it goes to
  `useCreateViewState` or `createViewStateAsync`; the imperative
  `createLinearGenomeView` takes the same name as its `assembly`. The circular
  view takes a list, `jbrowseHub: ['hg38', 'mm39']`, for two genomes on one
  circle.
- **`localFiles`**, a `name -> bytes` map, serves a host whose data is in a
  process, not at a URL: a notebook kernel, an R session, anywhere with no web
  server and no CORS. `tracks` then refers to a registered name as if it were a
  URL. Register an index under its conventional sibling name (`peaks.bed.gz` +
  `peaks.bed.gz.tbi`) and only the bytes the view needs are read.
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

## Build your own

[`@jbrowse/display-ui/embed`](https://jbrowse.org/storybook/byo/) holds the
blocks of a view you draw yourself. `createViewState` builds the engine, and
these draw it:

- **`EmbedProvider`** wraps the page. It mounts `DisplayUIProvider` (the plain,
  Material-free overlays a track draws while it loads or fails), the theme
  palette and `Notifications`.
- **`EngineBoundary`** wraps the component that calls `useCreateViewState` and
  draws a build that throws, such as a hub genome that does not exist.
- **`TrackStack`** draws a view's tracks and handles pan and zoom. `Track`,
  `Scalebar`, `LocationBox`, `Legend`, `ResizeHandle` and the rest are the
  pieces to place beside it.

Install them as direct dependencies. Under pnpm a package your code imports must
be in your own `package.json`, and `mobx-react` is needed to write an `observer`
component:

```bash
pnpm add @jbrowse/react-linear-genome-view2@next @jbrowse/display-ui@next @jbrowse/core@next mobx mobx-react react react-dom
```

The `next` tag is the v5 beta, and `latest` is v4, which has no
`@jbrowse/display-ui/embed`. Pin the exact version. An example that imports a
`@jbrowse/plugin-*` package needs that package added the same way. The
[examples](https://jbrowse.org/storybook/byo/) build from the main branch, so
they can run ahead of npm. Read the package's `.d.ts` to see what a release
exports.

**Sizing.** `TrackStack` sets `overflow: hidden` on its wrapper, and each track
takes the `height` in its `displayDefaults`. A track with more rows than fit,
such as a gene track with several isoforms at its default height, scrolls inside
itself. Set `displayDefaults: { height }` per track, add a `ResizeHandle` so the
reader can drag, and put the stack in a container that grows with its content.

**Keeping an existing config.** The `uri` and `displayDefaults` shorthand is
optional. The engine expands only a track that has a `uri` and no `adapter`, so
a track written in full, with its `adapter`, `displays` and `type`, or one on a
`FromConfigAdapter`, goes to `createViewState` unchanged. A
`JBrowseLinearGenomeView` track list moves over as it is.

## A picture first, then the view {#static-first-paint}

An embedded view shows an empty box until its JavaScript, its assembly and its
first track fetch have all arrived. A screenshot of the view's opening state
paints with the page instead, and the live view takes over once it has drawn.
Each package has a live example with the full source:
[LGV](https://jbrowse.org/storybook/lgv/static-first-paint/),
[CGV](https://jbrowse.org/storybook/cgv/static-first-paint/),
[app](https://jbrowse.org/storybook/app/static-first-paint/) and
[build your own](https://jbrowse.org/storybook/byo/static-first-paint/), where
`PosterFirst` from `@jbrowse/display-ui/embed` does everything below but the
screenshot.

- **Shoot the poster from the view itself**, at the width the embed will have.
  `waitForJBrowseReady` from `@jbrowse/capture` holds until every track has
  drawn. A `jb2export` figure has no toolbar and uses different fonts, so the
  page would jump when the live view replaced it.
- **Load the engine when the box nears the viewport.** An `IntersectionObserver`
  plus a dynamic `import()` (`React.lazy`) means a page with several embeds
  starts the engine for each one as the reader scrolls to it. Destructure what
  each `import()` returns (`const { X } = await import('pkg')`): a bundler keeps
  every export of a namespace it cannot see into, and loads those modules on
  page load wherever another page shares them.
- **Keep the poster up until the view reads ready.** Each component publishes
  `[data-app-phase="ready"]` once its tracks have drawn. Wait for it with
  `data-app-views` above 0, then two animation frames, so the view's pending
  renders paint before the poster comes down.
- **Hide the loading view with `opacity: 0`.** The LGV, CGV and app components
  set `all: initial` on their root to keep the host page's CSS out. That also
  resets an inherited `visibility`, so under `visibility: hidden` the loading
  scrim shows through the poster.
- **Crop the poster on a narrower screen.** Give it `width: 100%`, the height it
  was shot at, `object-fit: cover`, and an `object-position` of `left top` for a
  linear view or `center top` for the circle. The view keeps its height at any
  width, so the box keeps its height through the swap and the poster's text
  stays at full size.

The function that shoots each example's poster from its built page, with
`launchBrowser` and `waitForJBrowseReady` from `@jbrowse/capture`:

<!-- include: packages/browser-test-utils/src/examplesPoster.ts#shoot -->

```ts
const browser = await launchBrowser()
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 })
  await page.goto(url)
  await waitForJBrowseReady(page)
  // the page takes its old poster down once the view has drawn
  await page.waitForFunction(
    s => !document.querySelector(`${s} img`),
    {},
    embed,
  )
  const element = await page.$(embed)
  if (!element) {
    throw new Error(`no ${embed} on ${url}`)
  }
  await element.screenshot({ path: out })
  const box = await element.boundingBox()
  return { width: Math.round(box!.width), height: Math.round(box!.height) }
} finally {
  await browser.close()
}
```

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
| @jbrowse/display-ui (build your own) | vite      | [demo](https://jbrowse.org/demos/byo-vite)      | [source](https://github.com/GMOD/jbrowse-build-your-own-vite-demo)                  |

## See also

- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/jbrowse_anywidget): Python equivalent
- [](/docs/jbrowser): R/Shiny equivalent

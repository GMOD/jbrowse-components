---
title: Embedded components
description:
  Which React component to use to put a JBrowse view in your own app, and where
  to find working examples and demos for each
---

The embedded components are **React components** published on npm: render one
JSX element and you have a genome browser inside your own page. They are the
same views the full JBrowse app is built from, so a track config that works
there works here.

React 18 or newer is the only peer dependency. If your page isn't a React app,
the components also ship as a browser bundle you can load with a single
`<script>` tag, which pulls in the React it needs itself; see
[non-React hosts](#non-react-hosts) below.

## Choosing a package

| Goal                                              | Package                                                                                                                                                      | Component              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| One linear genome view                            | [`@jbrowse/react-linear-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view2), [examples](https://jbrowse.org/storybook/lgv/)     | `<LinearGenomeView>`   |
| One circular genome view (e.g. SV chord diagrams) | [`@jbrowse/react-circular-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-circular-genome-view2), [examples](https://jbrowse.org/storybook/cgv/) | `<CircularGenomeView>` |
| Complete app (multiple view types, synteny, etc)  | [`@jbrowse/react-app2`](https://www.npmjs.com/package/@jbrowse/react-app2), [examples](https://jbrowse.org/storybook/app/)                                   | `<JBrowse>`            |
| Make your own custom UI around the engine         | `createViewState` + [`@jbrowse/display-ui`](https://www.npmjs.com/package/@jbrowse/display-ui), [examples](https://jbrowse.org/storybook/byo/)               | —                      |

Each package's storybook is the reference for how to use it: copy-pasteable
React code, one page per task — setting up the view, navigating from your own
code, running a worker, theming, plugins, and more. Start there for anything
beyond the basic props below.

A `tracks` entry is a track config, and the shortest one is `{ trackId, uri }`:
the type and adapter come from the file's extension, and `assemblyNames` from
the single-view components' one `assembly`, or from an app config declaring just
one (see [the shortest track](/docs/config_guides/tracks#the-shortest-track)).

**`@jbrowse/react-app2` also needs its stylesheet**:
`import '@jbrowse/react-app2/styles.css'`. It is the only one of these packages
that ships a stylesheet; without it the panels, tabs and dividers render
unstyled while everything else looks correct.

**The props are initial values, like an input's `defaultValue`.** The engine is
built once, on first render, and later prop changes are ignored — so pointing an
already-mounted component at a different `assembly`, or a different plugin list,
does nothing. Give the element a React `key` that changes with the assembly and
React remounts it on a fresh engine.

## Embedded views versus the full app

Embedded views are designed for genome browsing within an existing webpage. For
a standalone browser, run [JBrowse Web](/docs/quickstart_web) instead.
`@jbrowse/react-app2` sits between the two: the whole JBrowse app as a React
component.

|                | Single-view components (LGV, CGV) | `@jbrowse/react-app2`                      | JBrowse Web                                                      |
| -------------- | --------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| View types     | One only                          | All of them, plugins included              | All of them, plugins included                                    |
| Feature detail | Opens in a dialog                 | Opens in a drawer                          | Opens in a left/right oriented drawer                            |
| Sessions       | No built-in saving or loading     | Held in your app's state, yours to persist | Save, import, export, plus local autosave                        |
| URLs           | The page owns the URL             | The page owns the URL                      | Reads [URL params](/docs/urlparams) like `&loc=` and `&session=` |

Embedded components are designed for web developers to build custom systems
around, so features like sessions and track manipulation can be implemented by
the embedding application. If your app is Python or R rather than JavaScript,
[](/docs/jbrowse_anywidget) and [](/docs/jbrowser) wrap the same views.

## Non-React hosts

Every package also exports an imperative controller — `createLinearGenomeView`,
`createCircularGenomeView`, `createApp` — with no JSX and no React root for you
to manage. It's what the [Python anywidget](/docs/jbrowse_anywidget), R
htmlwidgets, and plain `<script>` pages are built on. See the vanillajs rows in
[bundler examples](#bundler-examples) below for a working reference
implementation of each.

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

- [](/docs/automating)
- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/jbrowse_anywidget): Python equivalent
- [](/docs/jbrowser): R/Shiny equivalent

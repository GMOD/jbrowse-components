---
title: Embedded components
description:
  Which React component to use to put a JBrowse view in your own app, and
  working bundler examples for each
---

The embedded components are **React components** published on npm: render one
JSX element and you have a genome browser inside your own page. They are the
same views the full JBrowse app is built from, so a track config that works
there works here.

React 18 or newer is the only peer dependency. If your page isn't a React app,
the components also ship as a browser bundle you can load with a single
`<script>` tag, which pulls in the React it needs itself.

## Choosing a package

| Goal                                              | Package                                                                                                                                                      | Component              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| One linear genome view                            | [`@jbrowse/react-linear-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view2), [examples](https://jbrowse.org/storybook/lgv/)     | `<LinearGenomeView>`   |
| One circular genome view (e.g. SV chord diagrams) | [`@jbrowse/react-circular-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-circular-genome-view2), [examples](https://jbrowse.org/storybook/cgv/) | `<CircularGenomeView>` |
| Complete app (multiple view types, synteny, etc)  | [`@jbrowse/react-app2`](https://www.npmjs.com/package/@jbrowse/react-app2), [examples](https://jbrowse.org/storybook/app/)                                   | `<JBrowse>`            |

The props are the config: the single-view components take `assembly`, `tracks`,
and an `init` describing the view to open, and the app component takes
`assemblies`, `tracks`, and a `views` list. Each builds its own view engine, so
there is no imperative setup call to make. The storybook examples per package
are copy-pasteable React code.

**The props are initial values, like an input's `defaultValue`.** The engine is
built once, on first render, and later prop changes are ignored — so pointing an
already-mounted component at a different `assembly`, or a different plugin list,
does nothing. Give the element a React `key` that changes with the assembly and
React remounts it on a fresh engine.

## Driving the view from your own code

When you want to read or change the view after launch, hold the engine yourself
with `useCreateViewState` and render the `viewState`-taking component. That is
the same object the props version builds internally, so nothing is given up:

```jsx
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

function MyBrowser() {
  const state = useCreateViewState({ assembly, tracks, location: 'chr1:1-100' })
  return (
    <>
      <button onClick={() => state.session.view.showTrack('my_genes')}>
        Show genes
      </button>
      <JBrowseLinearGenomeView viewState={state} />
    </>
  )
}
```

`state` is the root model, so the view's actions are one level down at
`state.session.view` — `navToLocString`, `showTrack`, `horizontallyFlip`,
`exportSvg`. Anything marked `#action` on the
[view's state model](/docs/models/LinearGenomeView) is callable there.
`@jbrowse/react-app2` is session-centric instead, with `state.session.addView`
and `state.session.views[0]`.

It is all MobX state, so a component that needs to re-render when the view
changes should be an `observer` rather than subscribing to anything — that is
how `state.session.selection` drives a companion panel with no click handler
wiring.

## Hosts that don't write JSX

The same packages mount imperatively, with no React root for you to manage:
`createLinearGenomeView(element, options)` returns a controller, and
`createApp(element, options)` does the same for the whole app. React and
react-dom are still peer dependencies — this saves you the JSX, not React. It is
what the [Jupyter anywidget](/docs/jbrowse_jupyter), R htmlwidgets, and plain
`<script>` pages are built on.

```js
import { createLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const view = createLinearGenomeView(document.getElementById('root'), {
  assembly: 'hg38',
  tracks,
})
await view.setLocation('chr1:1,000-2,000')
// on teardown
view.destroy()
```

The controller is where the remount rule above stops applying: `setAssembly` and
`setSession` tear the engine down and rebuild it internally, so a host swaps
genomes by calling one method rather than by managing a `key`. `assembly` takes
four shapes — a sequence file URL (`.fa.gz`, `.2bit`), a hub name like `'hg38'`
or a GenArk accession, a whole hub config, or a bare assembly config — and a hub
name brings the hub's own name-search adapters with it, so gene-name navigation
works without wiring any up. `whenReady()` resolves once a build settles;
`destroy()` tears down the React root, the RPC workers, and the MST tree's
autoruns, which a bare React unmount does not.

`createApp`'s controller is the session-shaped counterpart: `addView`,
`removeView`, `setSession`, `destroy`.

For the plain `<script>` tag build, see the
[embedding tutorial](/docs/tutorials/embed_linear_genome_view).

Not sure if you want an embedded view or the full app? See the
[FAQ entry](/docs/faq#embedded-views-versus-full-jbrowse-app).

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
- [JBrowse Jupyter](/docs/jbrowse_jupyter): Python equivalent
- [](/docs/jbrowser): R/Shiny equivalent
- [FAQ: embedded views vs. full app](/docs/faq#embedded-views-versus-full-jbrowse-app)

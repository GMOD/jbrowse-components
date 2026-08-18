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

**`@jbrowse/react-app2` also needs its stylesheet**, which the single-view
components do not have: `import '@jbrowse/react-app2/styles.css'`.

It styles the app's tiled panel layout, so without it the panels, tabs and
dividers render unstyled while everything else looks correct. The file is
self-contained, so a page that isn't running a bundler can `<link>` it from the
package instead.

**The props are initial values, like an input's `defaultValue`.** The engine is
built once, on first render, and later prop changes are ignored — so pointing an
already-mounted component at a different `assembly`, or a different plugin list,
does nothing. Give the element a React `key` that changes with the assembly and
React remounts it on a fresh engine.

## Driving the view from your own code

When you want to read or change the view after launch, hold the engine yourself:
`useCreateViewState(opts)` and render the `viewState`-taking component. It takes
the same options the props component does, `init` included, so nothing is given
up — and unlike a `ref`, which arrives a render after mount, you have the engine
on the first render and can pass it to anything.

<!-- include: products/jbrowse-react-linear-genome-view/examples-site/src/examples/WithShowTrack.tsx -->

```tsx
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const TRACK_ID = 'volvox_gff3'

// `view.tracks` is observable, so an `observer` button knows whether the track
// is open without subscribing to anything — no callback, no local copy of the
// state that can fall out of step with the track selector's own checkbox.
const ToggleTrack = observer(function ToggleTrack({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { view } = viewState.session
  const open = !!view.getTrack(TRACK_ID)
  return (
    <button
      onClick={() => {
        // showTrack API: https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-showtrack
        if (open) {
          view.hideTrack(TRACK_ID)
        } else {
          view.showTrack(TRACK_ID)
        }
      }}
    >
      {open ? 'Hide' : 'Show'} the genes track
    </button>
  )
})

export default function WithShowTrack() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: TRACK_ID,
        name: 'Volvox genes',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      },
    ],
    // the view opens with the track closed, since this page is about opening it
    // from your own code. For a track that should be open on first paint, put
    // its id in `init.tracks` instead of calling showTrack at construction
    init: { loc: 'ctgA:1105..1221' },
  })
  return (
    <div>
      <ToggleTrack viewState={state} />
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}
```

`state` is the root model, so the view's actions are one level down at
`state.session.view` — `navToLocString`, `showTrack`, `horizontallyFlip`,
`exportSvg`. Anything marked `#action` on the
[view's state model](/docs/models/lineargenomeview) is callable there.
`@jbrowse/react-app2` is session-centric instead, with `state.session.addView`
and `state.session.views[0]`.

It is all MobX state, so a component that needs to re-render when the view
changes should be an `observer` rather than subscribing to anything — that is
how `state.session.selection` drives a companion panel with no click handler
wiring.

## Move the data work off the main thread

**An embedded view parses and renders on the main thread by default**, so a deep
BAM or CRAM stalls the page around it — including whatever else your app is
drawing. Pass a `makeWorkerInstance` factory and JBrowse switches its RPC to a
web worker instead; supplying the factory is the whole switch, no config slot
needed.

Every embedded package ships that factory already written, so the shortest
version imports it and passes it straight through —
`import makeWorkerInstance from '@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance'`,
then `makeWorkerInstance` as the option. Its body is the plain
`new Worker(new URL('./rpcWorker', import.meta.url))`. Take the subpath from the
package you render, never a sibling: each worker entry registers **its own**
product's plugin set, so the linear one boots a worker that has never heard of a
chord display. The circular package spells it
`@jbrowse/react-circular-genome-view2/esm/makeWorkerInstance`.

Write the `new URL` yourself only inside your own source tree. At your call site
the specifier is a bare package name, which `new URL` cannot resolve — the
relative path works in the shipped factory because it is resolved from inside
the package.

<!-- include: products/jbrowse-react-linear-genome-view/examples-site/src/examples/WithWebWorker.tsx -->

```tsx
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
// Vite/Astro apps construct the RPC worker with Vite's `?worker` suffix. (With
// a webpack/CRA setup you'd instead import the package's prebuilt
// `@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance`.)
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'

export default function WithWebWorker() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      },
    ],
    init: { loc: 'ctgA:1105..1221', tracks: ['volvox_gff3'] },
    // supplying makeWorkerInstance is enough — the RPC default driver
    // switches to WebWorkerRpcDriver automatically (no defaultDriver config
    // needed)
    makeWorkerInstance: () => new RpcWorker(),
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
```

The example above reaches for Vite's `?worker` suffix rather than the shipped
factory, and the reason is narrow enough to state: that site sets
`worker.format: 'es'`, because the worker code-splits. The shipped factory
constructs a **classic** worker, which cannot load an ES-module script, so under
ES worker output the `?worker` import — which builds the matching module worker
— is the form that runs. It builds either way; only the classic-worker version
fails, and it fails at runtime rather than at build.

That cuts the other way for plugins. A classic worker can `importScripts`, so it
loads a **UMD** plugin; a module worker cannot, so a Vite build with
`worker.format: 'es'` can't load UMD plugins worker-side. ESM plugins work in
both.

It is off by default only because constructing a worker is bundler-specific, not
because it is experimental — turn it on wherever your toolchain allows. webpack
and CRA want `output.publicPath: 'auto'` and the shipped factory.

### Plugins have to reach the worker too

The worker is a separate JavaScript realm with its own plugin registry, and it
does not inherit the main thread's. A plugin contributing anything that runs
there — an adapter, most commonly — has to be registered on both sides, and
**what decides whether it gets there is the `definition`, not the plugin**.

`loadPlugins` returns `{ plugin, definition }` records. Pass those through to
`plugins` unchanged. The definition is a URL, and it is the only thing the
worker can boot from: `PluginManager` records a runtime plugin in
`runtimePluginDefinitions` only when its load record carries one, `RpcManager`
ships exactly that list as the worker's boot config, and the worker fetches its
own copy from those URLs.

So `plugins: [MyPlugin]` — a bare class — registers on the main thread and
**never** in the worker. There is no definition to ship, nothing warns, and the
failure surfaces far from its cause: a track whose adapter type is unknown,
reported from inside the worker, on a page that worked before the worker was
switched on. `plugins.map(p => p.plugin)` throws the definition away the same
way and is the commoner spelling of the same bug.

The rule that follows is worth stating plainly: **if you pass plugin classes,
don't pass `makeWorkerInstance`.** A bare class is fine on the main thread,
where there is only one realm. Adding the worker gives it two, and the class
reaches only one of them.

## The remaining options

`disableAddTracks` hides the single-view components' own "add track"
affordances, for a page where the track set is yours to decide rather than the
reader's.

`drawerViewHeight` (default `100vh`) matters for one case: an embedded view is
normally content-height, so it grows with the page, but a view with an open
drawer widget has to be clamped to something for the drawer's own scrolling to
have a definite height. This is that clamp, and it applies only while a drawer
is open.

`@jbrowse/react-app2` adds `onPluginsUpdated`. The app cannot rebuild its own
plugin manager — it never fetches plugins, and it does not own the React tree it
is mounted into — so when a user adds one from the in-app plugin store it hands
you what a rebuild needs: `await loadPlugins(plugins)`, then remount with the
new `plugins` and the given `session` so the user lands where they were. Without
it, the change is only reported to the user and never takes effect.

## Hosts that don't write JSX

The same packages mount imperatively, with no React root for you to manage:
`createLinearGenomeView(element, options)` returns a controller, and
`createApp(element, options)` does the same for the whole app. React and
react-dom are still peer dependencies — this saves you the JSX, not React. It is
what the [Python anywidget](/docs/jbrowse_anywidget), R htmlwidgets, and plain
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

The remount rule above applies here too, and the controller is deliberately
small enough to make that obvious. The genome, the session and the track list
are what a browser is _built from_, so changing one is a new browser:
`destroy()` the controller and create another. What the controller offers is the
things that are not a rebuild — `setLocation`, `addTrack`, `removeTrack`,
`addLocalFiles` — plus `whenReady()`, which resolves with the model once the
build settles.

`whenReady()` is the whole read API, and there is deliberately nothing beside
it. The model it hands back is MobX-observable throughout: every `#getter` and
`#property` on the view and session models is reactive, so a JS host reads state
off the model rather than subscribing to a callback per fact. The three `on…`
options below exist for the hosts that _cannot_ do that — a notebook kernel or
an R session, whose state lives in another process.

`assembly` takes four shapes — a sequence file URL (`.fa.gz`, `.2bit`), a hub
name like `'hg38'` or a GenArk accession, a whole hub config, or a bare assembly
config — and a hub name brings the hub's own name-search adapters with it, so
gene-name navigation works without wiring any up. `destroy()` tears down the
React root, the RPC workers, and the MST tree's autoruns, which a bare React
unmount does not — a host that swaps genomes without it orphans a worker pool
per swap.

Data going the other way is three callbacks rather than a subscription.
`onLocationChange` fires with the visible region as the user pans and zooms
(throttled); `onFeatureSelect` with the serialized feature when one is clicked;
and `onSessionChange` with a plain-JSON snapshot of the layout the user built,
in the shape the `session` option takes — so "save this arrangement" is storing
that value and reopening it is passing it back. All three ride a coarse signal
that settles after a gesture instead of firing per frame, because each crossing
of a notebook's or a Shiny app's wire costs a round trip. `onError` is the
fourth: the build is async, so a failure has nowhere else to go but the console
unless the host takes it.

`localFiles` is the option that makes a host with no web server work at all: a
map of `name -> bytes` that `tracks` may then refer to by that name as if it
were a URL. They are read by byte range, so registering an index under its
conventional sibling name (`peaks.bed.gz` plus `peaks.bed.gz.tbi`) keeps the
file indexed — only the bytes the current view needs are touched, not the whole
array. `addLocalFiles` registers more later, for data that arrives after mount.
Handing the same bytes to a second controller is free: registration is keyed on
the object you pass, so rebuilding does not re-register them.

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
- [](/docs/jbrowse_anywidget): Python equivalent
- [](/docs/jbrowser): R/Shiny equivalent
- [FAQ: embedded views vs. full app](/docs/faq#embedded-views-versus-full-jbrowse-app)

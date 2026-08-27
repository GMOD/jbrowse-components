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
`assemblies`, `tracks`, and a `views` list. Each builds its own view engine. The
storybook examples per package are copy-pasteable React code.

A `tracks` entry is a track config, and the shortest one is `{ trackId, uri }`:
the type and adapter come from the file's extension, and `assemblyNames` from
the single-view components' one `assembly`, or from an app config declaring just
one (see [the shortest track](/docs/config_guides/tracks#the-shortest-track)).
The controllers below take a bare URL string as well.

**`@jbrowse/react-app2` also needs its stylesheet**:
`import '@jbrowse/react-app2/styles.css'`. It is the only one of these packages
that ships a stylesheet.

It styles the app's tiled panel layout, so without it the panels, tabs and
dividers render unstyled while everything else looks correct. The file is
self-contained, so a page that isn't running a bundler can `<link>` it from the
package.

**The props are initial values, like an input's `defaultValue`.** The engine is
built once, on first render, and later prop changes are ignored — so pointing an
already-mounted component at a different `assembly`, or a different plugin list,
does nothing. Give the element a React `key` that changes with the assembly and
React remounts it on a fresh engine.

### Embedded views versus the full app

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

**All of them can:**

- enable/disable tracks through the Track interface
- change the track's assembly based on what is available in the configuration
- manipulate the views with zoom, horizontal flip, view all regions, track label
  positioning, etc.
- change track display options
- export the view as an SVG

Embedded components are designed for web developers to build custom systems
around, so features like sessions and track manipulation can be implemented by
the embedding application. If your app is Python or R rather than JavaScript,
[](/docs/jbrowse_anywidget) and [](/docs/jbrowser) wrap the same views.

## Driving the view from your own code

When you want to read or change the view after launch, hold the engine yourself:
`useCreateViewState(opts)` and render the `viewState`-taking component. It takes
the same options the props component does, `init` included, and hands you the
engine on the first render, so you can pass it to anything.

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
`@jbrowse/react-app2` is session-centric, with `state.session.addView` and
`state.session.views[0]`.

It is all MobX state, so a component that needs to re-render when the view
changes should be an `observer` — that is how `state.session.selection` drives a
companion panel with no click handler wiring.

## Move the data work off the main thread

**An embedded view parses and renders on the main thread by default**, so a deep
BAM or CRAM stalls the page around it — including whatever else your app is
drawing. Pass a `makeWorkerInstance` factory and JBrowse switches its RPC to a
web worker; supplying the factory is the whole switch.

Every embedded package ships that factory already written:

- **Import it and pass it straight through** —
  `import makeWorkerInstance from '@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance'`,
  then `makeWorkerInstance` as the option. Its body is the plain
  `new Worker(new URL('./rpcWorker', import.meta.url))`.
- **Take the subpath from the package you render**, never a sibling: each worker
  entry registers **its own** product's plugin set, so the linear one boots a
  worker that has never heard of a chord display. The circular package spells it
  `@jbrowse/react-circular-genome-view2/esm/makeWorkerInstance`.
- **Write the `new URL` yourself only inside your own source tree.** At your
  call site the specifier is a bare package name, which `new URL` cannot resolve
  — the relative path works in the shipped factory because it is resolved from
  inside the package.

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

The example above uses Vite's `?worker` suffix because that site sets
`worker.format: 'es'`, since the worker code-splits. The shipped factory
constructs a **classic** worker, which cannot load an ES-module script, so under
ES worker output the `?worker` import builds the matching module worker and is
the form that runs. Both forms build; the classic-worker one fails at runtime.

The same split decides plugin loading. A classic worker can `importScripts`, so
it loads a **UMD** plugin; a module worker cannot, so a Vite build with
`worker.format: 'es'` can't load UMD plugins worker-side. ESM plugins work in
both.

It is off by default because constructing a worker is bundler-specific, so turn
it on wherever your toolchain allows. webpack and CRA want
`output.publicPath: 'auto'` and the shipped factory.

### Registering plugins in the worker

The worker is a separate JavaScript realm with its own plugin registry, and it
does not inherit the main thread's. A plugin contributing anything that runs
there — an adapter, most commonly — has to be registered on both sides, and
**what decides whether it gets there is the `definition`, not the plugin**.

`loadPlugins` returns `{ plugin, definition }` records. Pass those through to
`plugins` unchanged. The definition is a URL, and it is the only thing the
worker can boot from:

- `PluginManager` records a runtime plugin in `runtimePluginDefinitions` only
  when its load record carries one.
- `RpcManager` ships exactly that list as the worker's boot config.
- The worker fetches its own copy from those URLs.

So `plugins: [MyPlugin]` — a bare class — registers on the main thread and
**never** in the worker. There is no definition to ship, nothing warns, and the
failure surfaces far from its cause: a track whose adapter type is unknown,
reported from inside the worker, on a page that worked before the worker was
switched on. `plugins.map(p => p.plugin)` throws the definition away the same
way and is the commoner spelling of the same bug.

**If you pass plugin classes, don't pass `makeWorkerInstance`.** A bare class is
fine on the main thread, where there is only one realm; adding the worker gives
it two, and the class reaches only one of them.

## Other createViewState options

- **`disableAddTracks`** hides the single-view components' own "add track"
  affordances, for a page where the track set is yours to decide. That includes
  the LGV's `File` menu, if you asked for one — its two items, **Open track...**
  and **Open connection...**, are exactly those affordances, so with them gone
  the bar has nothing to hold and isn't drawn at all.
- **`menuBar`** draws that `File` menu in an app-shaped bar above the view, the
  way `@jbrowse/react-app` has one. **Off by default**: this component shipped
  without a bar, so one appearing unbidden would change every existing embed's
  layout. It takes a row out of `height` — a bounded component is `height` tall
  with the bar inside.
- **`height`** takes any CSS height (`'400px'`, `'80vh'`) and bounds the
  component's own root — the whole component, so a `menuBar` row comes out of it
  and the view takes what is left (48px of a 400px box, at present). Without it
  an embedded view is content-height and grows with the page. The tracks scroll
  inside the bound while the chrome above them stays put — title bar, navigation
  bar, overview scalebar, coordinate ruler — so a height shorter than the track
  set is tall costs you nothing but the scrollbar.

  It puts the scroll region inside the view, which is what the headers pin
  against — the same
  [`stickyViewHeaders`](https://github.com/GMOD/jbrowse-components/pull/4237)
  mechanism JBrowse Web uses. A sized box around the component scrolls the whole
  component, and no CSS outside it can pin the ruler.

- **`drawerViewHeight`** (default `100vh`) is the older spelling of the same
  thing, applied only while a drawer widget is open. It is honored when `height`
  is absent, and `height` wins when both are given. Prefer `height`.
- **`onPluginsUpdated`**, on `@jbrowse/react-app2` only. The app never fetches
  plugins and does not own the React tree it is mounted into, so it cannot
  rebuild its own plugin manager; when a user adds one from the in-app plugin
  store it hands you what a rebuild needs: `await loadPlugins(plugins)`, then
  remount with the new `plugins` and the given `session` so the user lands where
  they were. Without it, the change is only reported to the user and never takes
  effect.

## Mounting without JSX

The same packages mount imperatively, with no React root for you to manage:
`createLinearGenomeView(element, options)` and
`createCircularGenomeView(element, options)` each return a controller, and
`createApp(element, options)` does the same for the whole app. React and
react-dom are still peer dependencies. It is what the
[Python anywidget](/docs/jbrowse_anywidget), R htmlwidgets, and plain `<script>`
pages are built on.

```js
import { createLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const view = createLinearGenomeView(document.getElementById('root'), {
  assembly: 'hg38',
  tracks,
  location: 'chr1:1,000-2,000',
})

// later — state what you want to be true, not the steps to get there
await view.update({ location: 'chr7:5,500,000-5,600,000' })

// on teardown
view.destroy()
```

The controller has three methods:

- **`update(state)`** is the only write door, and it is declarative: you hand
  over the view you want and the controller reconciles to it.
- **`whenReady()`** resolves with the model once the build settles.
- **`destroy()`** tears the whole thing down.

`update` takes the same fields the options blob takes, minus the ones a browser
is _built from_ — the genome, the plugins, a restored session. Those are not
reconcilable: changing one is a different browser, so `destroy()` the controller
and create another. What is left is what the view is _showing_, and every field
of it can be re-stated at any time.

Two rules make that unambiguous:

- **Each field you state is the complete wanted value for it**:
  `update({ tracks: [a, b] })` opens `a` and `b` and closes everything else that
  was open, because a track list is the set you want on screen.
- **A field you leave out is left alone**: an update that says only `location`
  moves the view and touches no tracks.

So a host whose own state covers part of the view hands over that part, and a
host that holds the whole thing hands over the whole thing on every change —
which is what an anywidget traitlet, an htmlwidget re-render, and an Observable
cell all do natively.

`update` is also safe to call before the build settles, which matters because a
notebook cell or a Shiny observer fires as soon as it has a widget — long before
a hub fetch and an assembly load have finished. The state is recorded
immediately and applied when the engine arrives. It resolves once the state has
_reached_ the view rather than once the view has finished drawing: a `location`
goes to the same init machinery a URL launch uses, which waits for the assembly
and then navigates. Watch `onLocationChange` to see it land.

`whenReady()` is the whole read API. The model it hands back is MobX-observable
throughout: every `#getter` and `#property` on the view and session models is
reactive, so a JS host reads state straight off the model. The `on…` options
below exist for hosts whose state lives in another process — a notebook kernel,
an R session.

`assembly` takes four shapes — a sequence file URL (`.fa.gz`, `.2bit`), a hub
name like `'hg38'` or a GenArk accession, a whole hub config, or a bare assembly
config — and a hub name brings the hub's own name-search adapters with it, so
gene-name navigation works without wiring any up. `destroy()` tears down the
React root, the RPC workers, and the MST tree's autoruns, which a bare React
unmount does not — a host that swaps genomes without it orphans a worker pool
per swap.

Data going the other way arrives as callbacks:

- **`onLocationChange`** fires with the visible region as the user pans and
  zooms (throttled).
- **`onFeatureSelect`** fires with the serialized feature when one is clicked.
- **`onSessionChange`** fires with a plain-JSON snapshot of the layout the user
  built, in the shape the `session` option takes — so "save this arrangement" is
  storing that value and reopening it is passing it back.
- **`onError`** takes the build's failures: the build is async, so a failure
  reaches the console unless the host takes it.

The first three ride a coarse signal that settles after a gesture, because each
crossing of a notebook's or a Shiny app's wire costs a round trip.

`localFiles` is the option that makes a host with no web server work at all: a
map of `name -> bytes` that `tracks` may then refer to by that name as if it
were a URL. They are read by byte range, so registering an index under its
conventional sibling name (`peaks.bed.gz` plus `peaks.bed.gz.tbi`) keeps the
file indexed — only the bytes the current view needs are touched. It is the one
field that only grows: `update({ localFiles })` registers the names the
controller has not seen and keeps the rest, because a track config already
points at the blob a registered name minted. Handing the same bytes to a second
controller is free too — registration is keyed on the object you pass, so
rebuilding does not re-register them.

### The circular view controller

`createCircularGenomeView` is the same shape with one field swapped and one
callback missing.

```js
import { createCircularGenomeView } from '@jbrowse/react-circular-genome-view2'

const ring = createCircularGenomeView(document.getElementById('root'), {
  assembly: 'hg19',
  tracks: ['https://example.com/sv.vcf.gz'],
  displayedRegionNames: ['chr1', 'chr2', 'chr3'],
})

await ring.update({ displayedRegionNames: [] }) // back to the whole genome
```

`displayedRegionNames` takes the place of `location`: a circular view draws
every displayed region at once, so what changes is which chromosomes are on the
ring. Names resolve through the assembly's aliases and may be globs, an empty
list means the whole assembly, and naming the main chromosomes is how you keep a
few thousand unplaced contigs from each taking a hairline slice. They are the
same two fields the view's own `init` blob carries, which a URL spec and a saved
session carry too.

There is no `onLocationChange`: there is no visible region to report, so the
callback would only ever fire `undefined`. `onSessionChange` carries a change to
the ring.

The tracks a circular view draws are chord tracks, and a VCF is what the bundled
plugin set knows how to chord — so a bare `'sv.vcf.gz'` URL works, and a file
that guesses to some other track type reports that no compatible display exists.

`createApp`'s controller is the session-shaped counterpart: `addView`,
`removeView`, `setSession`, `destroy`.

For the plain `<script>` tag build, see the
[embedding tutorial](/docs/tutorials/embed_linear_genome_view).

Not sure if you want an embedded view or the full app? See
[embedded views versus the full app](#embedded-views-versus-the-full-app).

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

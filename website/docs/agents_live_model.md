---
title: Driving the live JBrowse session
sidebar_label: Live model guide
description:
  The working reference for code that runs against a live JBrowse session, from
  Desktop's run_javascript MCP tool or a browser agent on JBrowse Web
---

Desktop's `run_javascript` MCP tool runs an async JavaScript function body
inside the app's renderer, and what you `return` is serialized back to you. A
browser agent on JBrowse Web runs the same code in the page, where the value is
the last expression. In scope either way:

- `session`, the live MST session model: views, tracks, assemblies, dialogs
- `rootModel`, its parent: the jbrowse config, menus, `session` itself
- `pluginManager`, the plugin registry: track, view and adapter types, extension
  points
- `jb`, the helper library below
- `window`, the real DOM. In Desktop this is an Electron renderer with
  nodeIntegration, so Node is one `window.require` away

## The helper library

Orientation and building:

- `jb.sessionSummary()` is the orientation call: views, tracks with their
  display type and render phase, assemblies, visible regions.
- `jb.inspect(path?, maxBytes?)` walks the live model by dot path (`'views.0'`)
  and answers with the value, its getters, **the actions it takes** and its
  `modelType`. Reach for it before deciding a model cannot do something: MST
  attaches actions as non-enumerable properties, so `Object.keys(view)` lists
  none of them. An action's signature is under
  `docs topic:"model:<modelType>" section:"Actions"`, config slots by type under
  `docs topic:"config:BamAdapter"`, every name under `docs topic:"types"`.
- `jb.listTracks(search?, limit?)` is the track catalog with trackIds,
  connection and hub tracks included, capped at 100 by default. It answers
  `{ total, tracks }`.
- `jb.loadSessionSpec(spec, settleMs?)` builds views declaratively from the spec
  on `docs topic:"session-spec"`, settles for `settleMs` (default 30000)
  reporting what is still not ready, and returns the summary. It **replaces the
  session**: the `session` argument you were given is a dead node afterwards.
  Every `jb` helper re-reads the live one, and `jb.session` is it if you need to
  rebind. A spec `layout` indexes the spec's own `views` array; the live action
  `session.applyLayoutSpec` takes the same tree with `viewIds` in place of
  `views`, and accepts the wrong key silently, collapsing the workspace into one
  tab.
- `jb.addTrack({ location, index?, assembly?, name?, show?, viewId? })` adds a
  local path or URL, with the format inferred from the extension, and shows it.
- `jb.trackModel(trackId)` is the shown track's live model, or undefined.
- `track.applyDisplaySettings(settings)` styles the track's `activeDisplay` in
  place and returns `{ applied, unapplied, failed }`. `failed` means a key the
  display knows and could not set; `unapplied` lists keys that are not config
  slots, misspellings included.
- `jb.describeSlots(confNode)` lists every slot the node's schema defines, with
  type, description and default. An unknown settings key is dropped silently, so
  introspect before writing:
  `jb.describeSlots(jb.trackModel('x').activeDisplay.configuration)`.

Reading:

- `jb.getFeatures({ trackId, loc?, regions?, byteLimit? })` is the track's data
  as live Feature objects, over the visible region by default. See
  [Reading data directly](#reading-data-directly-fast-path).
- `await jb.visibleRegions(viewId?)` is the visible region as numbers
  (`{ assemblyName, refName, start, end }`), the same regions `getFeatures`
  reads by default, for binning or recomputing over exactly what is on screen.
- `jb.waitReady(timeoutMs)` resolves when tracks finish loading and drawing. Its
  result carries `notifications`, the session's error toasts, `notReady`: tracks
  whose display settled without drawing anything, each with its `phase`
  (`tooLarge`, `error`, `renderError`, `loading`), and `offscreen`: views taller
  than the window, naming what a viewport screenshot would cut off. A display
  over the fetch-size gate raises no toast and replaces its own subtree, so this
  is the only way to tell it from a track that drew. The screenshot looks fine
  either way.

Lower level:

- `jb.require(name)` is the module registry plugins link against, by the same
  names (`'@jbrowse/core/util'`, `'@jbrowse/core/configuration'`, `'react'`). In
  a browser, `await jb.ensureRequire()` once first.
- `jb.mst` and `jb.mobx` are the whole mobx-state-tree and mobx APIs.
- `jb.readConfObject(conf, 'slot')` and `jb.getConf(model, 'slot')` read config
  slots, which are not plain properties.
- `jb.rootModel` is the root model.
- `jb.parseLocString`, `jb.getFeatureAdapterOrThrow` (async),
  `jb.renameRegionsIfNeeded`, `jb.getRpcSessionId`, `jb.createStopToken` and
  `jb.stopStopToken` are direct data access, below.

## Calls and what they answer with

- State persists between `run_javascript` calls in the same app run: stash your
  own helpers on `globalThis` and reuse them.
- `session` can be replaced by the `open` tool or `jb.loadSessionSpec`, so
  re-read it per call and never cache it on `globalThis`.
- The `open` tool with no session open (the start screen) loads a new page, and
  `globalThis` starts empty on it. With a session open it swaps in place and
  your helpers survive.

Besides `value`, a call answers with:

- `logs`, everything the code passed to `console.log`, `info`, `warn`, `error`
  or `debug`, in order. Print intermediate state instead of returning it.
- `notifications`, toasts the session raised since the previous call, each with
  its `level`. A toast is reported once, on the first call after it fired, so an
  error from a track you added two calls ago arrives on this one.
- a thrown error as its message plus `at code line L, column C`, counted in your
  code, followed by the console output printed before it. A compile error has no
  line, because V8 gives none for a function body: look for an unbalanced
  bracket or an `await` inside a non-async callback.
- a call that outlives `timeoutMs` (default 120 s) answers with an error and the
  logs so far, and the code keeps running. For a long job, park the promise and
  come back for it:

```js
// call 1: start it and return at once
globalThis.job = (async () => {
  /* minutes of work */
  return result
})()
return 'started'
// call 2 (later): await globalThis.job
```

## In a browser

JBrowse Web publishes `window.jb` beside `window.JBrowseSession` and
`window.JBrowseRootModel`. The differences from Desktop:

- **No Node, so no local files.** `jb.addTrack` takes a URL and refuses a local
  path rather than adding a track that cannot read.
- **The data host has to allow the request.** A tab is subject to CORS where an
  Electron app is not, so a file that loads in Desktop may be unreachable from a
  page.
- **A read runs on the thread that draws**, so the page stops repainting while a
  large `jb.getFeatures` runs. Aggregate in code and return the answer.
- **`jb.require` needs `await jb.ensureRequire()` first**, once.
- **`jb.loadSessionSpec` also rewrites the URL** and stores a new session, and
  the one it replaced is not recoverable from the page. Prefer adding to the
  open session where that will do.

The Claude in Chrome extension changes the calling convention:

- **The value is the last expression.** End the snippet with the value, or wrap
  the body in `(async () => { ... })()`.
- **One evaluation has a fixed time budget**, about 45 seconds, and the code
  keeps running when it expires. `jb.loadSessionSpec` settles the new session
  before it answers, which on a cold hosted config can outlive the budget. Call
  it on its own, and read `jb.sessionSummary()` on the next call.
- **Results are sanitized on the way back.** Nested objects are cut off past a
  few levels, long strings are clipped, and a string that looks like base64 is
  replaced. Return flat, pre-sliced values, or a `JSON.stringify` of what you
  need.
- **Its screenshot knows nothing about rendering.** Call `jb.waitReady()` first,
  then screenshot, and read `notReady` from the settle result.
- **Wait for the page.** The app assigns `window.jb` after its first render, so
  poll for it after navigating.

## The model, oriented

```js
// what is open
session.views.map(v => ({ id: v.id, type: v.type }))
const view = session.views[0]

// a LinearGenomeView (check v.type — other view types differ)
view.visibleLocStrings // getter: what region is on screen
view.assemblyNames
view.navToLocString('BRCA1') // async; gene names go through text search
await view.launchTrack('mytrack', {}, { height: 300, displayMode: 'compact' })
view.hideTrack('mytrack')
// a shown track's live display model (getters are rich) — find by trackId,
// view.tracks is every shown track; activeDisplay is the one being drawn
const display = jb.trackModel('mytrack')?.activeDisplay
// the same track drawn by another of its display types (read arcs instead of
// the pileup): display ids are `<trackId>-<DisplayType>`, and the track's
// config lists the ones it has
const track = jb.trackModel('mytrack')
track.configuration.displays.map(d => d.displayId)
track.replaceDisplay(
  display.configuration.displayId,
  'mytrack-LinearReadArcsDisplay',
)
```

A feature's label is whatever `name` it carries, else its `id`, and a file
decides which: the hosted RefSeq GFF names a gene by `ID` and `gene_id` and
carries no `Name`, so `f.get('name')` is `null` there and `f.get('id')` is the
symbol. `Object.keys(f.toJSON())` says what one feature has before you filter on
a field.

- Reads are plain property or getter access; **mutations only through actions**
  (`view.setWidth(800)` works, `view.width = 800` throws).
- Snapshots (`jb.mst.getSnapshot(node)`) omit computed getters, so read getters
  off the live node.
- `launchTrack` on an already shown track applies nothing.
  `track.applyDisplaySettings(settings)` is the update path, and it routes each
  key through the same slot machinery a session spec's inline keys get.
- `docs topic:"model:<modelType>"` documents a display's own actions for
  anything a slot does not cover.
- A track too tall for the window wants a height strategy, not `displayMode`:
  many displays take `heightMode` `fit` or `grow`, and `compact` only shrinks
  each feature. `describeSlots` lists both.

```js
// make every shown track compact
for (const t of session.views.flatMap(v => v.tracks ?? [])) {
  t.applyDisplaySettings({ displayMode: 'compact' })
}
return jb.waitReady(30000)
```

## Reading data directly (fast path)

Adapters run on the main thread here, with no worker round trip, so features
stay as objects. Reduce and filter in place and return only what you need:

```js
// visible region by default; pass loc for an arbitrary region
const feats = await jb.getFeatures({
  trackId: 'volvox_test_vcf',
  loc: 'ctgA:1-50,000',
})
// Feature API: f.get('start'), f.get('name'), f.get('type'), f.toJSON()
return {
  n: feats.length,
  byType: Object.groupBy(feats, f => f.get('type') ?? 'unknown'),
}
```

- A region over the byte gate throws `region too large for jb.getFeatures`,
  naming the estimate and the limit, rather than answering short. Narrow the
  region, or pass `byteLimit` for a read you mean to be that big.
- A base-level quantitative track is one feature per base, so a 160 kb window is
  about 160k of them. Reduce with a loop, never `Math.max(...scores)`, which
  blows the call stack on an array that size.
- Never `return` thousands of raw features: aggregate, slice, or put them on
  screen as a track.

**To find out what a remote file holds before adding it as a track, build its
adapter and ask.** An adapter needs no track and no session, so this answers
"which assembly is this bigWig on" in one call:

```js
const adapter = await jb.getFeatureAdapterOrThrow({
  pluginManager,
  sessionId: 'probe',
  adapterConfig: {
    type: 'BigWigAdapter',
    bigWigLocation: { uri: url, locationType: 'UriLocation' },
  },
})
return (await adapter.getRefNames()).slice(0, 5)
```

`jb.getFeatures` does two things raw adapter code gets wrong silently, so if you
drop to `jb.getFeatureAdapterOrThrow` yourself, do both by hand:

- Translate canonical refNames into the file's own spelling with
  `jb.renameRegionsIfNeeded`. "ctgA" against a file saying "contigA" matches
  nothing and reads as "no data here".
- Derive the adapter-cache `sessionId` from the shown track
  (`jb.getRpcSessionId(jb.trackModel(trackId))`) so you share the parsed indexes
  the display already warmed.

## Showing something you derived

A track built from values you just computed does not need a file.
`FromConfigAdapter` carries the features in the track's own config, so the
derived track is part of the session and survives a save and reopen.

```js
session.addSessionTrackConf({
  type: 'QuantitativeTrack', // FeatureTrack for non-numeric features
  trackId: 'nutlin-log2',
  name: 'log2(nutlin / DMSO)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'FromConfigAdapter',
    adapterId: 'nutlin-log2',
    features: bins.map((score, i) => ({
      uniqueId: 'bin' + i,
      refName: 'chr6', // the assembly's canonical spelling
      start: start + i * BIN,
      end: start + (i + 1) * BIN,
      score,
    })),
  },
})
await session.views[0].launchTrack('nutlin-log2')
return jb.waitReady(60000)
```

- `adapterId` is the adapter cache key; leave it out and the whole feature array
  is hashed instead.
- `addSessionTrackConf` is the destination for a track you stood up on the
  user's behalf; `session.tracks` is the site's catalog.
- **Recomputed the values? Delete, re-add, and change the `adapterId`.**
  `addSessionTrackConf` refuses a known trackId whose content differs (the same
  content is idempotent), and the adapter cache is keyed on `adapterId`, so the
  same id with new features keeps serving the first array it saw.
- **Plan for a few thousand features, not more.** The array lives in the track
  config, so it is held in memory, written into the session snapshot, and
  re-serialized by every autosave. Above that, run the tool that does the job
  (`bigwigCompare`, `bedGraphToBigWig`, deeptools), write a real indexed file
  and load that with `jb.addTrack`.

```js
const old = session.sessionTracks.find(t => t.trackId === 'nutlin-log2')
if (old) {
  session.deleteTrackConf(old)
}
session.addSessionTrackConf({
  ...conf,
  adapter: { ...conf.adapter, adapterId: `nutlin-log2-${Date.now()}` },
})
await session.views[0].launchTrack('nutlin-log2')
```

## Waiting on the app

- Model mutations render asynchronously. After navigating or adding tracks,
  `await jb.waitReady(30000)` before reading render state or screenshotting.
  `jb.mobx.when(() => predicate)` awaits any observable condition.
- To prove a track really drew rather than settled empty, pair the empty
  `notReady` with a `jb.getFeatures` count over the visible region. Do not go
  looking for pixels: displays render into offscreen canvases and paint the
  result, so the `<canvas>` elements in the page measure 0x0.
- A freshly created view throws "width undefined" from region-dependent getters
  (`visibleRegions`, `visibleLocStrings`, `dynamicBlocks`) until its component
  mounts and sets a width. `await jb.mobx.when(() => view.initialized)` before
  reading them on a view you just made.
- Long synchronous loops block the UI thread, so chunk big work with
  `await new Promise(r => setTimeout(r))` between batches.
- "Does it all fit in the window" is arithmetic: `jb.sessionSummary()` reports
  each view's `height` and each track's display `height`, so compare the sum
  against the view before capturing anything.
- A whole-window screenshot spends most of its pixels on chrome, and a session
  taller than the window is cut off at the bottom — the settle result says so
  under `offscreen`. `screenshot` takes `fullPage: true` for the whole laid-out
  document, `selector` to crop to one element —
  `[data-testid="view-container-<view.id>"]` for a view, id from
  `jb.sessionSummary()` — or `rect` with a box you measured.

## Shell tools and files, from Desktop

The machine's tools are one `window.require` away, which is the route for a
client with no shell of its own. A real pipeline step runs here and its output
loads with `jb.addTrack`:

```js
const { execFile } = window.require('child_process')
const { promisify } = window.require('util')
const run = promisify(execFile)
const { stdout } = await run('samtools', ['idxstats', '/data/sample.bam'])
return stdout.split('\n').slice(0, 5)
```

A `fetch` from here carries a browser Origin and obeys CORS, and some hosts
refuse it (NCBI's acc.cgi answers 403; eutils does not).
`window.require('https')` or `curl` under `window.require('child_process')`
carries neither and reads the same bytes.

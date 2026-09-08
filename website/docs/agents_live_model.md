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
- `jb`, the helper library below. `jb.help` restates this contract in one
  string, for an agent that finds the object before this page.
- `signal` (Desktop only), an `AbortSignal` that fires when the call's
  `timeoutMs` expires — check it in long loops so a timed-out call stops instead
  of pinning the renderer
- `window`, the real DOM. In Desktop this is an Electron renderer with
  nodeIntegration, so Node is one `window.require` away

## The helper library

A helper exists where the raw model answers wrong **silently** (a refName the
file spells differently, a display that replaced its subtree without a toast, a
name several views could answer) and turns that into a throw or a report.
Everything else is done with the model; the re-exports at the end are frozen.

Orientation and building:

- `jb.sessionSummary()` is the orientation call: views, tracks with their
  display type and render phase, assemblies, visible regions.
- `jb.inspect(path?, maxBytes?)` walks the live model by dot path (`'views.0'`)
  and answers with the value, its getters, **the actions it takes** and its
  `modelType`. MST actions are non-enumerable, so `Object.keys` lists none of
  them. An action's signature is under
  `docs topic:"model:<modelType>" section:"Actions"`, config slots by type under
  `docs topic:"config:BamAdapter"`, every name under `docs topic:"types"`.
- `jb.listTracks(search?, limit?)` is the track catalog with trackIds,
  connection and hub tracks and each assembly's reference sequence track
  included, capped at 100 by default. It answers `{ total, tracks }`.
- `jb.loadSessionSpec(spec, settleMs?)` builds views declaratively from the spec
  on `docs topic:"session-spec"`, settles for `settleMs` (default 30000)
  reporting what is still not ready, and returns the summary. It **replaces the
  session**: the `session` argument you were given is a dead node afterwards.
  Every `jb` helper re-reads the live one, and `jb.session` is it if you need to
  rebind. A spec `layout` indexes the spec's own `views` array.
- `session.layoutViews(spec)` arranges the views already open into panels
  without replacing the session: the same tree as a spec `layout` (a leaf
  carries `views`, a container `children` and a `direction`), with a leaf naming
  view ids from `jb.sessionSummary()` or indexes into `session.views`. It turns
  workspaces on, applies the stated order and returns the ids it seated; the
  lower-level `session.applyLayoutSpec` does neither and leaves the views
  stacked down the page, which is how a session grows taller than the window
  (`jb.waitReady`'s `offscreen`). `viewIds` is not a key; a node carrying one
  throws.
- `jb.addTrack({ location, index?, assembly?, name?, show?, viewId?, settleMs? })`
  adds an absolute local path or a URL (a relative path is refused), infers the
  format from the extension, shows it and settles; an unreadable file reports in
  the settle's `notReady`. `settleMs: 0` skips the settle, for several adds and
  one `jb.waitReady`.
- `jb.view(viewId?)` is the open view. With several open and no `viewId` it
  throws naming each one, as do `jb.trackModel`, `jb.visibleRegions` and
  `jb.addTrack` when more than one view could answer. `viewId` comes from
  `jb.sessionSummary()`; nested synteny and breakpoint views count as open.
- `jb.trackModel(trackId, viewId?)` is the shown track's live model. It throws
  when no view shows the track, saying whether the id is unknown or the track is
  not shown.
- `track.applyDisplaySettings(settings)` styles the track's `activeDisplay` in
  place and returns `{ applied, unapplied, failed }`: `failed` is a key the
  display knows and could not set (a wrongly typed value included), `unapplied`
  a key that is not a config slot, misspellings included.
- `jb.describeSlots(confNode)` lists every slot the node's schema defines, with
  type, description and default. Introspect before writing:
  `jb.describeSlots(jb.trackModel('x').activeDisplay.configuration)`.

Reading:

- `jb.getFeatures({ trackId, loc?, assembly?, viewId?, regions?, byteLimit? })`,
  or `jb.getFeatures(trackId, loc?, { assembly?, viewId?, byteLimit? })`, is the
  track's data as live Feature objects, over the visible region by default.
  `assembly` is for a track that names none; a wrong one, or a visible region
  from a view on another assembly, throws rather than reading the wrong
  coordinates. See [Reading data directly](#reading-data-directly-fast-path).
- `await jb.visibleRegions(viewId?)` is the visible region as numbers
  (`{ assemblyName, refName, start, end }`), the same regions `getFeatures`
  reads by default, for binning or recomputing over exactly what is on screen.
- `jb.waitReady(timeoutMs?)` resolves when views and tracks finish loading and
  drawing (default 30000). Its result carries `notifications` (the session's
  error toasts), `notReady` (views that failed to initialize or are still
  `initializing`, and tracks whose display settled without drawing, with the
  `phase`: `tooLarge`, `error`, `renderError`, `loading`) and `offscreen` (views
  taller than the window). Neither a gated display nor a failed view raises a
  toast, and both look plausible in a screenshot; this report is what tells.

Lower level, frozen at what shipped:

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
- `open` from the start screen loads a new page and `globalThis` starts empty;
  with a session open it swaps in place and your helpers survive.

Besides `value`, a call answers with:

- `logs`, everything the code passed to `console.log`, `info`, `warn`, `error`
  or `debug`, in order. Print intermediate state instead of returning it.
- `notifications`, toasts the session raised since the previous call, each with
  its `level`, each reported once, on the first call after it fired.
- a thrown error as its message plus `at code line L, column C`, counted in your
  code, followed by the console output printed before it. A compile error has no
  line, because V8 gives none for a function body: look for an unbalanced
  bracket or an `await` inside a non-async callback.
- a call that outlives `timeoutMs` (default 120 s) answers with an error and the
  logs so far, and the code keeps running with its `signal` aborted — work that
  checks `signal.aborted` stops. For a long job, park the promise and come back
  for it:

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
// the open view; with several open, jb.view() throws naming them and
// jb.view(id) picks one
const view = jb.view()

// a LinearGenomeView (check v.type — other view types differ)
view.visibleLocStrings // getter: what region is on screen
view.assemblyNames
view.navToLocString('BRCA1') // async; a gene name goes through text search and
// SHOWS the track whose index answered — 4th arg { showHitTrack: false } stops that
await view.launchTrack('mytrack', {}, { height: 300, displayMode: 'compact' })
view.hideTrack('mytrack')
// a shown track's live display model (getters are rich) — find by trackId,
// view.tracks is every shown track; activeDisplay is the one being drawn
const display = jb.trackModel('mytrack').activeDisplay
// open the feature-details panel on a feature you read, as a click would
display.selectFeature(feature)
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
- A track too tall for the window wants a height strategy, not `displayMode`: a
  display may take `heightMode` `fit` or `grow`, and `compact` only shrinks each
  feature. `describeSlots` lists both.

```js
// make every shown track compact
for (const t of session.views.flatMap(v => v.tracks ?? [])) {
  t.applyDisplaySettings({ displayMode: 'compact' })
}
return jb.waitReady(30000)
```

## Reading data directly (fast path)

`jb.getFeatures` asks the same worker the track's display uses, so a shown
track's parsed index is reused, and the features come back as Feature objects.
Reduce and filter in place and return only what you need:

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
- The reference sequence is a track too: `jb.listTracks` lists each assembly's
  as a `ReferenceSequenceTrack`, and `jb.getFeatures` on its trackId answers one
  feature per region whose `seq` holds the bases.

- Never `return` thousands of raw features: aggregate, slice, or put them on
  screen as a track.

**To find out what a remote file holds before adding it as a track, build its
adapter and ask.** The helper is async and returns the adapter. `getRefNames()`
is on every feature adapter; `getHeader()` answers for formats with one (BAM,
CRAM, VCF, BED, GFF3) and `null` for a bigWig:

```js
const adapter = await jb.getFeatureAdapterOrThrow({
  pluginManager,
  sessionId: 'probe',
  adapterConfig: {
    type: 'BigWigAdapter',
    bigWigLocation: { uri: url, locationType: 'UriLocation' },
  },
})
return {
  refNames: (await adapter.getRefNames()).slice(0, 5),
  header: await adapter.getHeader(),
}
```

The probe's adapter lives on the main thread under the `sessionId` you gave it,
for the life of the page: fine for a header, not for features. `jb.getFeatures`
does two things raw adapter code gets wrong silently:

- It renames canonical refNames to the file's spelling with
  `jb.renameRegionsIfNeeded`; "ctgA" against a file saying "contigA" matches
  nothing and reads as "no data here".
- It reads on the worker the track's display uses, so the index that display
  parsed is reused. A main-thread adapter for the same file is a second copy.

**An action's argument shape, when the docs have no page for it** (a view from a
plugin outside this tree): open a throwaway view, call the action with `{}` so
the model materializes its defaults, inspect what it created, remove the view:

```js
const probe = session.addView('ProteinView', {})
probe.addStructure({})
const shape = jb.inspect(`views.${session.views.length - 1}.structures.0`)
session.removeView(probe)
return shape
```

**Saving.** Desktop writes the session to its `.jbrowse` file about a second
after every change; `rootModel.flushSession()` forces it. Web has no save from
`jb`: the spec you loaded is the record.

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
await jb.view().launchTrack('nutlin-log2')
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
await jb.view().launchTrack('nutlin-log2')
```

## Waiting on the app

- Model mutations render asynchronously. After navigating or adding tracks,
  `await jb.waitReady(30000)` before reading render state or screenshotting.
  `jb.mobx.when(() => predicate)` awaits any observable condition.
- To prove a track really drew rather than settled empty, pair the empty
  `notReady` with a `jb.getFeatures` count over the visible region. Do not go
  looking for pixels: displays render into offscreen canvases and paint the
  result, so the `<canvas>` elements in the page measure 0x0.
- A freshly created view throws "width undefined" from its region getters until
  it mounts and navigates. Read them with `await jb.visibleRegions(viewId)`,
  which waits for both: `initialized` is already true in the window before
  navigation, where `visibleRegions` is silently empty.
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

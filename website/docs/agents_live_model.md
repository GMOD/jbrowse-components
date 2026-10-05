---
title: Driving the live JBrowse session
sidebar_label: Live model guide
description:
  The working reference for code that runs against a live JBrowse session, from
  Desktop's run_javascript MCP tool or a browser agent on JBrowse Web
---

Desktop's `run_javascript` MCP tool runs an async JavaScript function body
inside the app's renderer and serializes what you `return`. A browser agent on
JBrowse Web runs the same code in the page, where the value is the last
expression. In scope either way:

- `session`, the live MST session model: views, tracks, assemblies, dialogs
- `rootModel`, its parent: the jbrowse config, menus, `session` itself
- `pluginManager`, the plugin registry: track, view and adapter types, extension
  points
- `jb`, the helper library below; `jb.help` restates it in one string
- `signal` (Desktop only), an `AbortSignal` that fires when `timeoutMs` expires;
  check it in long loops
- `window`, the real DOM. In Desktop that is an Electron renderer with
  nodeIntegration, so Node is one `window.require` away

## The helper library

A helper exists where the raw model answers wrong **without an error** — an
unrenamed refName, a display that replaced its subtree without a toast, a name
several views could answer — and turns that into a throw or a report. Everything
else is done with the model.

Orientation and building:

- `jb.sessionSummary()` orients: views, tracks (display type, render phase),
  assemblies, visible regions, `drawer` and `dialog`.
- `jb.inspect(node?, maxBytes?)`: a live node's value, getters, **actions** and
  `modelType`; `Object.keys` lists no MST action. Bare, it is the session.
- `jb.listTracks(search?, limit?)`: the catalog, `{ total, tracks }` of
  `{ trackId, name, type, assemblyNames }`, 100 by default.
- `jb.loadSessionSpec(spec, settleMs?)` builds views from a spec
  (`docs topic:"session-spec"`), settles (default 30000) and answers the settle
  plus the summary. It **replaces the session**: your `session` argument is dead
  afterwards, and `jb.session` is the live one.
- `jb.addView(spec, settleMs?)` opens one entry of a spec's `views` beside what
  is open; an unknown key throws first. Answers `{ viewId }` plus the settle.
- `jb.setSession(document, settleMs?)` rewrites the session as a document,
  `jb.mst.getSnapshot(jb.session)` edited: an entry keeping its `id` is patched,
  one dropped is closed, one without is new, and a top-level key left out keeps
  its value.
- `jb.fitToWindow(settleMs?)` shrinks what is open until it fits the window.
- `jb.addTrack({ location, index?, assembly?, name?, show?, viewId?, settleMs? })`
  adds an absolute local path or a URL (relative refused), infers the format,
  shows it and settles; an unreadable file reports in `notReady`.
- `jb.addTrack({ trackId, settings?, viewId?, settleMs? })` shows a catalog
  track; the file keys are refused.
- `jb.view(viewId?)` is the open view. With several open and no `viewId` it
  throws naming each, as do `jb.trackModel`, `jb.visibleRegions`, `jb.addTrack`
  and `jb.getFeatures`; `viewId` comes from `jb.sessionSummary()`.
- `jb.trackModel(trackId, viewId?)` is the shown track's live model; it throws
  when no view shows it.
- `track.applyDisplaySettings(settings)` styles `activeDisplay` in place and
  returns `{ applied, unapplied, failed }`; read the report, since an unapplied
  key is not an error.
- `jb.describeSlots(confNode)` lists every slot the node's schema defines, with
  type, description and default:
  `jb.describeSlots(jb.trackModel('x').activeDisplay.configuration)`.

Reading:

- `jb.getFeatures({ trackId, loc?, assembly?, viewId?, regions?, byteLimit? })`,
  or `jb.getFeatures(trackId, loc?, { assembly?, viewId?, byteLimit? })`, is the
  track's data as live Feature objects, over the visible region by default. It
  runs `renameRegionsIfNeeded`, so a file spelling "ctgA" "contigA" answers. See
  [Reading data directly](#reading-data-directly-fast-path).
- `await jb.visibleRegions(viewId?)` is the visible region as numbers
  (`{ assemblyName, refName, start, end }`).
- `jb.waitReady(timeoutMs?)` resolves when views and tracks finish loading and
  drawing (default 30000), answering `notifications` (error toasts), `notReady`
  (views failed or `initializing`, tracks settled without drawing (`phase`) or
  drawn around config (`notices`)), `offscreen` (views taller than the window),
  `drawer` and `dialog`. None raises a toast, so check this report.

The foundations:

- `jb.require(name)` is the module registry plugins link against, by the same
  names (`'@jbrowse/core/util'`, `'react'`); a browser needs
  `await jb.ensureRequire()` once first.
- `jb.mst` and `jb.mobx` are the whole mobx-state-tree and mobx APIs.
- `jb.readConfObject(conf, 'slot')` and `jb.getConf(model, 'slot')` read config
  slots, which are not plain properties.
- `jb.rootModel` is the root model.

## What changed since v4

- One `LinearAlignmentsDisplay` draws pileup, coverage, read arcs and read cloud
  as its slots (`readConnections: 'arc'`); `LinearPileupDisplay`,
  `LinearSNPCoverageDisplay`, `LinearReadArcsDisplay` and
  `LinearReadCloudDisplay` are aliases of it, not types to `replaceDisplay` to.
- A view's launch keys go directly on the view object in a spec or a snapshot;
  the v4 `init: { ... }` nesting is unwrapped with a warning.
- Synteny and dotplot rows each take `loc` and `displayedRegionNames`, in a spec
  and in `jb.setSession`, so an axis is navigated declaratively.

## Calls and what they answer with

State persists between calls in one app run: stash helpers on `globalThis`. The
`open` tool and `jb.loadSessionSpec` replace `session`, so re-read it per call
and never cache it. `open` from the start screen loads a new page, emptying
`globalThis`.

Besides `value`, a call answers with:

- `logs`, the console output in order. Print intermediate state instead of
  returning it.
- `notifications`, toasts the session raised since the previous call, each with
  its `level`, each reported once.
- `pageErrors`, the throws that got no toast: an uncaught exception, an
  unawaited rejection, a mobx reaction that died. Nothing else reports these.
- a thrown error as its message plus `at code line L, column C`, counted in your
  code. A compile error has no line; look for an unbalanced bracket or an
  `await` in a non-async callback.
- a call that outlives `timeoutMs` (default 120 s) answers with an error and the
  logs so far; the code keeps running with `signal` aborted. For a long job,
  park the promise:

```js
// call 1
globalThis.job = (async () => {
  /* minutes of work */
})()
return 'started'
// call 2 (later): await globalThis.job
```

## Waiting on the app

- Model mutations render asynchronously: `await jb.waitReady(30000)` after
  navigating or adding tracks, before reading render state or capturing.
  `jb.mobx.when(() => predicate)` awaits any observable condition.
- To prove a track drew, pair an empty `notReady` with a `jb.getFeatures` count
  over the visible region. Do not look for pixels: displays render into
  offscreen canvases, so the page's `<canvas>` elements measure 0x0.
- A freshly created view throws "width undefined" from its region getters until
  it mounts and navigates; `await jb.visibleRegions(viewId)` waits for both.
- Long synchronous loops block the UI thread; chunk big work with
  `await new Promise(r => setTimeout(r))`.
- Screenshot when the change is visual and whenever the settle reports
  `notReady` or `offscreen`; for show, hide, reorder, navigate and fit, the
  settle plus `jb.sessionSummary()` verifies. Read any image you take.
- Whether it all fits is arithmetic: `jb.sessionSummary()` reports each view's
  and display's `height`. A window capture cuts off a taller session;
  `screenshot` takes `fullPage: true`, `selector`
  (`[data-testid="view-container-<view.id>"]`) or a measured `rect`.

## Deep dives

Everything above is the contract. Read one when a task reaches past it.

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
// the same track drawn by another of its display types, shown or not; a type
// this view cannot draw is refused, naming `compatibleDisplays`, the ones it can
await view.launchTrack(
  'mytrack',
  {},
  { type: 'LinearMultiSampleVariantDisplay' },
)
```

A variation the display owns is a setting on it: an alignments track has one
`LinearAlignmentsDisplay` whose read arcs, read cloud and coverage are slots, so
arcs are `applyDisplaySettings({ readConnections: 'arc' })` and `describeSlots`
lists what else it takes.

A display's grammar settings are its plot: `display.plot` lists them by slot
name, the ones that display declares among `facet`, `color`, `rows`, `rowColor`,
`scales` and `filter`, and on a mark display `marks` and `transform`. A change
is a copy edited and handed back: `structuredClone(display.plot)`, edited as any
object, then `display.plotProblems(draft)`, which throws what a config file
would be refused for and lists what the display cannot draw, and
`display.applyPlot(draft)`. An object replaces the setting whole and `null`
resets it. A string is the one-value form, the facet's field or a constant
color, and an object spells the rest out: `facet: { field, domain }` orders the
sections, `color: { field, domain, range }` hands the `domain` values the
`range` colors in order. A field is a feature attribute, a dotted path such as
`INFO.SVTYPE`, or `strand`; an alignments track's facet field is a read
dimension (`pairOrientation`, `mapq`, ...) or a tag (`tags.HP`). The `filter` is
a list of `jexl:` expressions, such as `["jexl:feature.type == 'gene'"]`.
"Advanced → Edit plot..." in the track menu is the same object as text.

A plot of a track's features, written as ggplot2 writes one, is the
`LinearMarkDisplay` on any feature, alignments, variant or quantitative track:
`marks` (layers, each a `mark` with an `encoding` over feature fields and its
own `transform` steps), `transform`, `facet`, `rows` and `scales`, all in its
`plot`. The same plot applied to another track's mark display draws the same
thing there. The docs topic `plots` is the whole vocabulary, with the ggplot2
and Vega-Lite name for each idea.

A feature's label is whatever `name` it has, else its `id`, and a file decides
which: the hosted RefSeq GFF names a gene by `ID` and `gene_id` and has no
`Name`, so `f.get('name')` is `null` there and `f.get('id')` is the symbol.
`Object.keys(f.toJSON())` says what one feature has before you filter on a
field.

- Reads are plain property or getter access; **mutations only through actions**
  (`view.setWidth(800)` works, `view.width = 800` throws).
- Snapshots (`jb.mst.getSnapshot(node)`) omit computed getters, so read getters
  off the live node.
- `launchTrack` on an already shown track applies the inline settings it was
  given through `track.applyDisplaySettings(settings)`, so a spec entry or a
  `jb.setSession` document naming `{ trackId, height }` restyles a shown track
  as well as opening a new one — a view's launch keys work beside its built
  state, so `loc` on a patched view navigates it. Every route puts each key
  through the same slot machinery.
- A misspelled key on a spec's track entry — one that is neither a config slot
  nor something the display has — raises an error notification naming it. A spec
  has no return channel of its own, so that is where it reports, rather than
  loading the track with the setting missing. A spec `layout` indexes the spec's
  own `views` array.
- An action's signature is under `docs topic:"model:<modelType>"`
  `section:"Actions"` — the `modelType` `jb.inspect` answered with — config
  slots by type under `docs topic:"config:BamAdapter"`, every name under
  `docs topic:"types"`. That is where a display's own actions live, for anything
  a slot does not cover. With the name already in hand, pass the name as the
  `section` — `section:"setColor"` answers with that one line, where the section
  holding it is the whole getter or action list, and the page's contents says
  how many characters that is.
- A track too tall for the window wants a height strategy, not `displayMode`: a
  display may take `heightMode` `fit` or `grow`, and `compact` only shrinks each
  feature. `describeSlots` lists both.
- The `drawer` in `jb.sessionSummary()` is the widget panel, and it reports the
  width that panel takes off every view; `session.hideAllWidgets()` closes it.
  `jb.listTracks` covers connection and hub tracks as well as the session's own.

The fine print on the building helpers, once the one-liners above stop being
enough:

- A `notReady` entry's `phase` is `tooLarge`, `error`, `renderError`, `loading`,
  or `canceled` for a load the user stopped, which
  `track.activeDisplay.reload()` retries.
- `applyDisplaySettings` answers `{ applied, unapplied, failed }`: `failed` is a
  key the display knows and could not set (a wrongly typed value included).
  `unapplied` holds `{ key, reason }` — `no-slot` for a key no slot covers,
  misspellings included, and `setter-only` for one the display takes through a
  `set<Key>` action, which you call yourself.
- `jb.addView` goes through the same launcher a spec uses, a ProteinView's
  `connectedView` shorthand included.
- `jb.addTrack` takes `settleMs: 0` to skip the settle, for several adds
  followed by one `jb.waitReady`.
- `jb.fitToWindow` shrinks every display, synteny band and dotplot in proportion
  to its headroom.
- Nested synteny and breakpoint rows count as open views, so they are among the
  candidates `jb.view` names; a container's `viewId` covers its rows when the
  container itself cannot answer.

```js
// make every shown track compact
for (const t of session.views.flatMap(v => v.tracks ?? [])) {
  t.applyDisplaySettings({ displayMode: 'compact' })
}
return jb.waitReady(30000)
```

`session.layoutViews(spec)` arranges the views already open into panels without
replacing the session: the same tree as a spec `layout` (a leaf has `views`, a
container `children` and a `direction`), with a leaf naming view ids from
`jb.sessionSummary()` or indexes into `session.views`. It applies the stated
order and returns the ids it seated; the lower-level `session.applyLayoutSpec`
arranges the panels but leaves each tab's views in their old order. `viewIds` is
not a key; a node with one throws.

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

- `loc` is one place: a locstring, or a region object
  (`{ refName, start, end }`, what `jb.visibleRegions` answers). Several places
  go in `regions`.
- `assembly` is for a track that names none. A wrong one, or a visible region
  from a view on another assembly, throws rather than reading the wrong
  coordinates.
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

For a read of your own, `jb.require('@jbrowse/core/util')` has `parseLocString`,
`renameRegionsIfNeeded` and the `getRpcSessionId` an `rpcManager.call` needs;
pass an `AbortController`'s `signal` in the args to cancel it.

**To find out what a remote file holds before adding it as a track, build its
adapter and ask.** The adapter cache is a registry module, and `getAdapter` is
async and answers `{ dataAdapter }`. `getRefNames()` is on every feature
adapter; `getHeader()` answers for formats with one (BAM, CRAM, VCF, BED, GFF3)
and `null` for a bigWig:

```js
const { getAdapter } = jb.require(
  '@jbrowse/core/data_adapters/dataAdapterCache',
)
const { dataAdapter } = await getAdapter(pluginManager, 'probe', {
  type: 'BigWigAdapter',
  bigWigLocation: { uri: url, locationType: 'UriLocation' },
})
return {
  refNames: (await dataAdapter.getRefNames()).slice(0, 5),
  header: await dataAdapter.getHeader(),
}
```

The probe's adapter lives on the main thread under the `sessionId` you gave it,
for the life of the page: fine for a header, not for features. `jb.getFeatures`
does two things raw adapter code gets wrong without an error:

- It renames canonical refNames to the file's spelling with core's
  `renameRegionsIfNeeded`; "ctgA" against a file saying "contigA" matches
  nothing and reads as "no data here".
- It reads on the worker the track's display uses, so the index that display
  parsed is reused. A main-thread adapter for the same file is a second copy.

**An action's argument shape, when the docs have no page for it** (a view from a
plugin outside this tree): open a throwaway view, call the action with `{}` so
the model materializes its defaults, inspect what it created, remove the view:

```js
const probe = session.addView('ProteinView', {})
probe.addStructure({})
const shape = jb.inspect(probe.structures[0])
session.removeView(probe)
return shape
```

**Saving.** Desktop writes the session to its `.jbrowse` file about a second
after every change; `rootModel.flushSession()` forces it. Web has no save from
`jb`: the spec you loaded is the record.

## Showing something you derived

A track built from values you just computed does not need a file.
`FromConfigAdapter` holds the features in the track's own config, so the derived
track is part of the session and survives a save and reopen.

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

A `fetch` from here has a browser Origin and obeys CORS, and some hosts refuse
it (NCBI's acc.cgi answers 403; eutils does not). `window.require('https')` or
`curl` under `window.require('child_process')` has neither and reads the same
bytes.

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
- **Its screenshot captures whatever is on screen, with no wait for rendering.**
  Call `jb.waitReady()` first, then screenshot, and read `notReady` from the
  settle result.
- **Wait for the page.** The app assigns `window.jb` after its first render, so
  poll for it after navigating.

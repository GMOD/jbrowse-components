# Driving the live JBrowse session from `run_javascript`

The `run_javascript` tool runs an async JavaScript function body inside the
app's renderer. What you `return` is serialized back to you. In scope:

- `session` — the live MST session model (views, tracks, assemblies, dialogs)
- `rootModel` — its parent (jbrowse config, menus, `session` itself)
- `pluginManager` — plugin registry: track/view/adapter types, extension points
- `jb` — the standard library. High level:
  - `jb.sessionSummary()` — views, tracks, assemblies, visible regions; the
    orientation call
  - `jb.inspect(path?, maxBytes?)` — walk the live model by dot-path
    (`'views.0'`): the value, its getters (the high-value state a snapshot
    filters out) and **the actions it takes**. Reach for it before deciding a
    model cannot do something: MST attaches actions as NON-ENUMERABLE
    properties, so `Object.keys(view)` lists none of them, and a view that has
    `moveTrack`, `moveTrackUp` and `moveTrackToTop` looks like it has no way to
    reorder a track
  - `jb.listTracks(search?, limit?)` — the track catalog with trackIds
    (connection/hub tracks included; default cap 100)
  - `jb.loadSessionSpec(spec)` — build views declaratively (docs topic
    "session-spec"); replaces the open views, settles, returns the summary. It
    REPLACES the session, so the `session` argument you were given is a dead
    node afterwards — every `jb` helper re-reads the live one for you, and
    `jb.session` is it if you need to rebind: `session = jb.session`
  - `track.applyDisplaySettings(settings)` — a model ACTION on every track:
    in-place styling of the track's `activeDisplay` with the same slot routing
    and legacy-key handling a session spec's inline keys get; returns { applied,
    unapplied, failed }. `failed` is a key whose write threw — the one that
    means you got it wrong; `unapplied` also collects keys that are simply not
    config slots. (Each display also has it, for addressing a non-active display
    — settings vocabularies are per display type.)
  - `jb.addTrack({ location, index?, assembly?, name?, show? })` — local path or
    URL, format inferred from the extension
  - `jb.getFeatures({ trackId, loc? })` — the track's data as live Feature
    objects (see below)
  - `jb.waitReady(timeoutMs)` — resolves when tracks finish loading/drawing. Its
    result carries `notifications` (the session's error toasts) and `notReady`:
    tracks whose display settled without drawing anything, each with its `phase`
    (`tooLarge`, `error`, `renderError`, `loading`). A display over the
    fetch-size gate raises NO toast and replaces its own subtree, so this is the
    only way to tell it apart from a track that drew — the screenshot looks fine
    either way

  Lower level:
  - `jb.require(name)` — the same module registry external plugins link against,
    by the same names: `jb.require('@jbrowse/core/util')`,
    `'@jbrowse/core/configuration'`, `'@jbrowse/core/util/tracks'`,
    `'@jbrowse/core/ui'`, `'react'`, ... Anything core serves that jb does not
    name directly comes from here.
  - `jb.mst` — the whole mobx-state-tree API (`getSnapshot`, `onPatch`,
    `resolveIdentifier`, `getType`, `isAlive`, ...)
  - `jb.mobx` — the whole mobx API (`autorun`, `when`, `runInAction`,
    `observable`, ...)
  - `jb.readConfObject(conf, 'slotName')` / `jb.getConf(model, 'slotName')` —
    read config slots (plain property access on a config model does NOT work)
  - `jb.describeSlots(confNode)` — every config slot the node's schema defines,
    with type/description/default. Introspect instead of guessing: an unknown
    settings key is dropped SILENTLY. Select the track you mean by id, e.g.
    `jb.describeSlots(view.tracks.find(t => t.configuration.trackId === 'x').activeDisplay.configuration)`
  - `jb.parseLocString(str, refName => true)` — locstring parsing
  - `jb.getFeatureAdapterOrThrow({ pluginManager, sessionId, adapterConfig })` —
    direct data access, see below
  - `jb.renameRegionsIfNeeded(session.assemblyManager, { regions, adapterConfig, sessionId })`
    — canonical refNames → the file's own, see below
  - `jb.trackModel(trackId)` — the shown track's live model (or undefined)
  - `jb.getRpcSessionId(trackModel)`, `jb.createStopToken()`,
    `jb.stopStopToken(t)`

- `window` — real DOM plus Node via `window.require` (fs, path, ...); this is an
  Electron renderer with nodeIntegration

State persists between `run_javascript` calls in the same app run: stash your
own helpers on `globalThis` (`globalThis.myHelpers = {...}`) and reuse them.
`session` can be REPLACED by the open tool or `jb.loadSessionSpec` — re-read it
per call, never cache it on globalThis.

What a call answers with, besides `value`:

- `logs` — everything the code passed to `console.log/info/warn/error/debug`, in
  order. Print intermediate state instead of returning it.
- `notifications` — toasts the session raised since the previous call, each with
  its `level`. A toast is reported ONCE, on the first call after it fired, so an
  error from a track you added two calls ago arrives on this one.
- a thrown error comes back as its message plus `at code line L, column C`
  counted in YOUR code, followed by the console output printed before it. A
  compile error has no line (V8 gives none for a function body): look for an
  unbalanced bracket or an `await` inside a non-async callback.
- a call that outlives `timeoutMs` (default 120 s) answers with an error and the
  logs so far, and the code KEEPS RUNNING. For a long job, park the promise and
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

## The model, oriented

```js
// what is open
session.views.map(v => ({ id: v.id, type: v.type }))
const view = session.views[0]

// a LinearGenomeView (check v.type — other view types differ)
view.visibleLocStrings // getter: what region is on screen
view.assemblyNames
view.navToLocString('BRCA1') // async; gene names go through text search
view.showTrack('mytrack', {}, { height: 300, displayMode: 'compact' })
view.hideTrack('mytrack')
// a shown track's live display model (getters are rich) — find by trackId,
// view.tracks is every shown track; activeDisplay is the one being drawn
const display = view.tracks.find(
  t => t.configuration.trackId === 'mytrack',
)?.activeDisplay

// track catalog (config models — use jb.readConfObject)
session.tracks.map(t => ({
  trackId: t.trackId,
  name: jb.readConfObject(t, 'name'),
  adapter: jb.readConfObject(t, 'adapter').type,
}))
```

MST rules: reads are plain property/getter access; **mutations only through
actions** (`view.setWidth(800)` works, `view.width = 800` throws). Snapshots
(`jb.mst.getSnapshot(node)`) omit computed getters — read getters off the live
node. Write display settings with `track.applyDisplaySettings(settings)` — it
targets the track's `activeDisplay`, routes each key through the same slot
machinery a session spec's inline keys get (legacy keys included), and reports
what applied — and `jb.describeSlots(display.configuration)` lists the slots
that exist before you write one.

```js
// make every shown track compact
for (const t of session.views.flatMap(v => v.tracks ?? [])) {
  t.applyDisplaySettings({ displayMode: 'compact' })
}
return jb.waitReady(30000)
```

## Reading data directly (fast path)

Adapters run on the main thread here — no worker round trip, features stay as
objects. Reduce/filter in place and return only what you need:

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

**To find out what a remote file holds before adding it as a track, build its
adapter and ask.** An adapter needs no track and no session, so this answers
"which assembly is this bigWig on" in one call rather than by fetching the
file's header and parsing it by hand:

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
drop to `jb.getFeatureAdapterOrThrow` yourself, do both by hand: translate
canonical refNames into the file's own spelling with `jb.renameRegionsIfNeeded`
("ctgA" vs "contigA" — a query in the wrong namespace matches nothing and reads
as "no data here"), and derive the adapter-cache `sessionId` from the shown
track (`jb.getRpcSessionId(jb.trackModel(trackId))`) so you share the parsed
indexes the display already warmed.

Mind the sizes. A base-level quantitative track (phastCons, a bigWig at full
resolution) is one feature per base, so a 160 kb window is ~160k of them: reduce
with a loop, never `Math.max(...scores)`, which blows the call stack on an array
that size. And don't `return` thousands of raw features — aggregate, slice, or
put them on screen as a track (next section).

## Showing something you derived

A track built from values you just computed does not need a file.
`FromConfigAdapter` carries the features in the track's own config, so the
derived track is part of the session: it survives a save and reopen, and it
needs no filesystem at all.

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
session.views[0].showTrack('nutlin-log2')
return jb.waitReady(60000)
```

`adapterId` is the adapter cache key; leave it out and the whole feature array
is hashed instead. `addSessionTrackConf` is the destination for a track you
stood up on the user's behalf — `session.tracks` is the site's catalog.

**Recomputed the values? Delete, re-add, and change the `adapterId`.** Both
halves fail silently otherwise: `addSessionTrackConf` returns the EXISTING conf
when the trackId is already known, so re-adding with new features keeps the old
ones; and the adapter cache is keyed on `adapterId`, so the same id with new
features keeps serving the first array it saw.

```js
const old = session.sessionTracks.find(t => t.trackId === 'nutlin-log2')
if (old) {
  session.deleteTrackConf(old)
}
session.addSessionTrackConf({
  ...conf,
  adapter: { ...conf.adapter, adapterId: `nutlin-log2-${Date.now()}` },
})
session.views[0].showTrack('nutlin-log2')
```

**Plan for a few thousand features, not more.** The array lives in the track
config, so it is held in memory, written into the session snapshot, and
re-serialized by every autosave from then on. That fits a window of bins, a peak
list, a set of hits, and nothing bigger. Above it, run the tool that does the
job (`bigwigCompare`, `bedGraphToBigWig`, deeptools), write a real indexed file
and load that with `jb.addTrack` — computing in the renderer holds the whole
input in the process that is also drawing the view.

## Waiting on the app

Model mutations render asynchronously. After navigating or adding tracks,
`await jb.waitReady(30000)` before reading render state or screenshotting.
`jb.mobx.when(() => predicate)` awaits any observable condition.

To prove a track really drew rather than settled empty, pair the empty
`notReady` with a `jb.getFeatures` count over the visible region. Do NOT go
looking for pixels: displays render into offscreen canvases and paint the
result, so the `<canvas>` elements in the page measure 0x0 and a DOM hunt for
them proves nothing either way.

A freshly created view THROWS "width undefined" from region-dependent getters
(`visibleRegions`, `visibleLocStrings`, `dynamicBlocks`) until its component
mounts and sets a width — `await jb.mobx.when(() => view.initialized)` before
reading them on a view you just made.

Long synchronous loops block the UI thread — chunk big work with
`await new Promise(r => setTimeout(r))` between batches.

"Does it all fit in the window" is arithmetic, not a screenshot:
`jb.sessionSummary()` reports each view's `height` and each track's display
`height`, so compare the sum against the view before capturing anything.

## Beyond the app: shell tools and files

This is an Electron renderer with nodeIntegration, so the machine's tools are
one `window.require` away — the route for a client with no shell of its own. A
real pipeline step (`bigwigCompare`, `samtools`, `bedGraphToBigWig`) runs here
and its output loads with `jb.addTrack`:

```js
const { execFile } = window.require('child_process')
const { promisify } = window.require('util')
const run = promisify(execFile)
const { stdout } = await run('samtools', ['idxstats', '/data/sample.bam'])
return stdout.split('\n').slice(0, 5)
```

`globalThis` dies with the app. A helper worth keeping across restarts goes in a
file: write it with `window.require('fs')` as a CommonJS module and load it with
`window.require('/path/to/helpers.js')` (`delete window.require.cache[path]`
first to pick up an edit).

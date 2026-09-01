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
    (`'views.0.visibleLocStrings'`); an object result lists its getters, the
    high-value state a snapshot filters out
  - `jb.listTracks(search?)` — the track catalog with trackIds
  - `jb.loadSessionSpec(spec)` — build views declaratively (docs topic
    "session-spec"); replaces the open views, settles, returns the summary
  - `jb.applyDisplaySettings(trackModel, settings)` — in-place styling with the
    same slot routing and legacy-key handling the track menu uses; returns {
    applied, unapplied }
  - `jb.addTrack({ location, index?, assembly?, name?, show? })` — local path or
    URL, format inferred from the extension
  - `jb.getFeatures({ trackId, loc? })` — the track's data as live Feature
    objects (see below)
  - `jb.waitReady(timeoutMs)` — resolves when tracks finish loading/drawing; its
    result carries the session's own error notifications

  Lower level:
  - `jb.mst` — the whole mobx-state-tree API (`getSnapshot`, `onPatch`,
    `resolveIdentifier`, `getType`, `isAlive`, ...)
  - `jb.mobx` — `autorun`, `when`, `runInAction`, `observable`
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
node. Write display settings with
`jb.applyDisplaySettings(trackModel, settings)` — it routes each key through the
same slot machinery the track menu uses (legacy keys included) and reports what
applied — and `jb.describeSlots(display.configuration)` lists the slots that
exist before you write one.

```js
// make every shown track compact
for (const t of session.views.flatMap(v => v.tracks ?? [])) {
  jb.applyDisplaySettings(t, { displayMode: 'compact' })
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

`jb.getFeatures` does two things raw adapter code gets wrong silently, so if you
drop to `jb.getFeatureAdapterOrThrow` yourself, do both by hand: translate
canonical refNames into the file's own spelling with `jb.renameRegionsIfNeeded`
("ctgA" vs "contigA" — a query in the wrong namespace matches nothing and reads
as "no data here"), and derive the adapter-cache `sessionId` from the shown
track (`jb.getRpcSessionId(jb.trackModel(trackId))`) so you share the parsed
indexes the display already warmed.

Mind the sizes: don't `return` thousands of raw features — aggregate, slice, or
write to a file with `window.require('fs')` and return the path.

## Waiting on the app

Model mutations render asynchronously. After navigating or adding tracks,
`await jb.waitReady(30000)` before reading render state or screenshotting.
`jb.mobx.when(() => predicate)` awaits any observable condition.

A freshly created view THROWS "width undefined" from region-dependent getters
(`visibleRegions`, `visibleLocStrings`, `dynamicBlocks`) until its component
mounts and sets a width — `await jb.mobx.when(() => view.initialized)` before
reading them on a view you just made.

Long synchronous loops block the UI thread — chunk big work with
`await new Promise(r => setTimeout(r))` between batches.

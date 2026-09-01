# Driving the live JBrowse session from `evaluate`

The `evaluate` tool runs an async JavaScript function body inside the app's
renderer. What you `return` is serialized back to you. In scope:

- `session` — the live MST session model (views, tracks, assemblies, dialogs)
- `rootModel` — its parent (jbrowse config, menus, `session` itself)
- `pluginManager` — plugin registry: track/view/adapter types, extension points
- `jb` — helper namespace:
  - `jb.mst` — the whole mobx-state-tree API (`getSnapshot`, `onPatch`,
    `resolveIdentifier`, `getType`, `isAlive`, ...)
  - `jb.mobx` — `autorun`, `when`, `runInAction`, `observable`
  - `jb.readConfObject(conf, 'slotName')` / `jb.getConf(model, 'slotName')` —
    read config slots (plain property access on a config model does NOT work)
  - `jb.describeSlots(confNode)` — every config slot the node's schema defines,
    with type/description/default. Introspect instead of guessing: an unknown
    settings key is dropped SILENTLY. e.g.
    `jb.describeSlots(session.views[0].tracks[0].displays[0].configuration)`
  - `jb.parseLocString(str, refName => true)` — locstring parsing
  - `jb.getFeatureAdapterOrThrow({ pluginManager, sessionId, adapterConfig })` —
    direct data access, see below
  - `jb.renameRegionsIfNeeded(session.assemblyManager, { regions, adapterConfig, sessionId })`
    — canonical refNames → the file's own, see below
  - `jb.getRpcSessionId(trackModel)`, `jb.createStopToken()`,
    `jb.stopStopToken(t)`
  - `jb.waitReady(timeoutMs)` — resolves when all tracks have finished
    loading/drawing (the same gate the screenshot tool uses)
- `window` — real DOM plus Node via `window.require` (fs, path, ...); this is an
  Electron renderer with nodeIntegration

State persists between `evaluate` calls in the same app run: stash your own
helpers on `globalThis` (`globalThis.myHelpers = {...}`) and reuse them.
`session` can be REPLACED by open/load_session_spec — re-read it per call, never
cache it on globalThis.

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
view.tracks[0].displays[0] // the live display model (its getters are rich)

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
node. To write a display config slot in place:
`display.configuration.setSlot('displayMode', 'compact')` (the track tool's
"update" action does this with legacy-key handling; prefer it unless you need
more), and `jb.describeSlots(display.configuration)` lists the slots that exist
before you write one.

## Reading data directly (fast path)

Adapters run on the main thread here — no worker round trip, features stay as
objects. Reduce/filter in place and return only what you need:

The `sessionId` picks the adapter-cache namespace: derive it from the SHOWN
track model (`jb.getRpcSessionId(trackModel)`) to share the adapter instance —
parsed indexes, chunk caches — the display already warmed. `session.id` works as
a fallback for a track nothing is showing, at the cost of a cold adapter.

```js
const conf = session.getTrackById('volvox_test_vcf')
const trackModel = session.views
  .flatMap(v => v.tracks ?? [])
  .find(t => t.configuration.trackId === 'volvox_test_vcf')
const sessionId = trackModel ? jb.getRpcSessionId(trackModel) : session.id
// REQUIRED: translate the assembly's canonical refNames into the file's own
// spelling ("ctgA" vs "contigA", "1" vs "chr1"). Skip this and a query in the
// wrong namespace matches nothing — it reads as "no data here", silently.
const renamed = await jb.renameRegionsIfNeeded(session.assemblyManager, {
  regions: [{ assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 }],
  adapterConfig: jb.readConfObject(conf, 'adapter'),
  sessionId,
})
const adapter = await jb.getFeatureAdapterOrThrow({
  pluginManager,
  sessionId,
  adapterConfig: renamed.adapterConfig,
  sequenceAdapter: renamed.sequenceAdapter,
})
const feats = await adapter.getFeaturesArray(renamed.regions[0])
// Feature API: f.get('start'), f.get('name'), f.get('type'), f.toJSON()
return {
  n: feats.length,
  byType: Object.groupBy(feats, f => f.get('type') ?? 'unknown'),
}
```

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

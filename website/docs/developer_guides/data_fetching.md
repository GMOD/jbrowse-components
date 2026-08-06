---
title: Data fetching pipeline
description:
  How MultiRegionDisplayMixin fetches data, the autorun chain, and rpcProps
guide_category: Core concepts
---

**TL;DR:** Most linear displays compose `MultiRegionDisplayMixin`, which
installs the autoruns that manage fetch lifecycle, cancellation, and cache
invalidation. You override `fetchNeeded` (usually via `fetchEachRegion`) and
declare `rpcProps` as the cache key. This chain is the thing to understand for
writing a non-GPU display, and for debugging unexpected refetches in any
display.

The exceptions are displays whose data isn't partitioned by region at all; they
compose `GlobalDataDisplayMixin` or `GlobalFetchMixin` and install their own
fetch autorun. See
[display foundations](/docs/developer_guides/creating_display#display-foundations)
for which foundation each in-tree display uses.

## The fetch autoruns

<!-- FETCH_AUTORUNS START -->

`MultiRegionDisplayMixin`'s `afterAttach` installs five autoruns:

<!-- prettier-ignore -->
| Autorun | Fires on | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` changes | `clearAllRpcData()` **+ `clearByteEstimate()`** — the only place the cached byte estimate is dropped |
| `FetchVisibleRegions` | the viewport, or `fetchGeneration` after a fetch ends (debounced 600 ms) | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. Skipped while `error` / `regionTooLarge` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized |
| `SettingsInvalidate` | `rpcPropsCacheKey`, the serialized `rpcProps()` return | `clearAllRpcData()`. Installed only when the display defines `rpcProps()` |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and self-releasing |
| `ClearHoverOnRegionTooLarge` | `regionTooLarge` becoming true | the overridable `onRegionTooLarge()` hook — a no-op unless the display overrides it |

<!-- FETCH_AUTORUNS END -->

`clearAllRpcData()` cancels the in-flight fetch, clears `error` and
`loadedRegions`, resets the canvas-drawn flag, and calls
`clearDisplaySpecificData()` — the hook your display overrides to drop its own
`rpcDataMap`. Cancelling bumps `fetchGeneration`, which re-fires
`FetchVisibleRegions` to start fresh fetches.

It deliberately leaves the too-large gate alone. `regionTooLarge` is derived
from the cached byte estimate and the current viewport, so it releases itself
and needs no imperative clear; keeping the estimate is what stops the banner
flickering on an ordinary clear.

## FetchVisibleRegions: the core fetch trigger

This autorun fires on any change to the viewport, after the debounce quoted in
the table above. For each visible region block it checks whether the data is
already loaded and still valid:

```
view.visibleRegions changes
  ↓ (debounced)
for each visible block:
  loadedRegion = loadedRegions.get(block.displayedRegionIndex)
  boundsValid  = refName matches AND start/end within loaded bounds
  cacheValid   = self.isCacheValid(block.displayedRegionIndex)   ← override hook

  if boundsValid AND cacheValid → skip (already have data)
  else → add to `needed`

if needed.length > 0:
  self.fetchNeeded(needed)
```

Regions are buffered (wider than the viewport) so panning doesn't immediately
trigger a new fetch.

## Implementing fetchNeeded

`fetchNeeded` is the hook you override to make RPC calls. The mixin's primitive
is `fetchRegions(needed, work)`, which handles cancellation, stop tokens, and
byte estimation. Most displays don't call it directly: they use the
`fetchEachRegion` wrapper, which runs one RPC per region in parallel and applies
the two `ctx.isStale()` guards for you. Forgetting either guard is a stale-data
write, so the wrapper is a correctness primitive, not just a convenience. Prefer
it. `LinearScoreDisplay`'s is a whole one, sitting in an
`.actions(self => ({ ... }))` block, with `getRpcSessionId` from
`@jbrowse/core/util/tracks`, `getSession` from `@jbrowse/core/util` and
`fetchEachRegion` from `@jbrowse/plugin-linear-genome-view`:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts#fetchNeeded -->

```ts
// called by the fetch autorun for the regions that need loading;
// fetchEachRegion handles cancellation, stop tokens and staleness
fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
  const { adapterConfig } = self
  if (!adapterConfig) {
    return undefined
  }
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)
  return fetchEachRegion(self, needed, {
    // rpcManager.call injects sessionId from its first argument, so it
    // does not go in the args object — a registered method's args are
    // Omit<…, 'sessionId'>, and passing it again is a type error
    call: (region, ctx, displayedRegionIndex) =>
      rpcManager.call(sessionId, 'GetScoreData', {
        adapterConfig,
        region,
        ...self.rpcProps(),
        stopToken: ctx.stopToken,
        // the RPC layer replaces this function with a side-channel and
        // calls it on the main thread as the worker reports progress
        statusCallback:
          self.makeRegionStatusCallback(displayedRegionIndex),
      }),
    onResult: (idx, result) => {
      self.setRpcData(idx, result)
    },
  })
},
```

`call` keeps the literal RPC method name at the call site so its typed args and
return survive, and `makeRegionStatusCallback` aggregates every region's
progress into one bar. A batched counterpart, `fetchAllRegions`, hands all
regions to a single RPC call (use it when the adapter serves the whole set in
one pass more efficiently, e.g. BigWig coalescing adjacent blocks).

### The raw `fetchRegions` primitive

Drop to `fetchRegions` directly only when a display's fetch genuinely diverges
from one-call-per-region: canvas prunes and folds a too-large result, MAF
fetches summary vs detail, alignments builds a chain payload. You then own both
`ctx.isStale()` guards by hand. MAF's is a worked case — it runs a second RPC
concurrently under the same stop token, and takes one staleness guard around the
whole batch rather than per region:

<!-- include: plugins/maf/src/LinearMafDisplay/fetchMafData.ts#rawFetchRegions -->

```ts
await self.fetchRegions(needed, async (ctx: FetchContext) => {
  // The CDS-frame annotation overlay (when configured) fetches in the same
  // stop-token-guarded pass as the main data so the two share staleness +
  // loadedRegions book-keeping; the two RPCs run concurrently.
  const [results] = await Promise.all([
    callEachRegion(needed, ctx, call),
    fetchAnnotationData(self, needed, ctx),
  ])
  // One guard around the whole batch, not per region as in `fetchEachRegion`:
  // `setSamples` is a cross-region decision over `results`, so a partial
  // commit would publish a sample set derived from a superseded viewport.
  if (ctx.isStale()) {
    return
  }
  const sampleSet = unionSampleSets(results)
  if (sampleSet) {
    self.setSamples(sampleSet)
  }
  commit(results)
})
```

`ctx.isStale()` returns `true` if the user panned/zoomed or settings changed
while the fetch was in flight. Always check it before writing results, since
stale writes trigger unnecessary re-renders. Where you put the check is the
decision `fetchEachRegion` makes for you: per region, results commit as they
arrive; around the batch, as above, a cross-region decision can't be made from a
half-superseded set.

## rpcProps: the cache key

`SettingsInvalidate` watches `rpcPropsCacheKey`, the **serialized return value**
of `rpcProps()`. When that string changes it calls `clearAllRpcData()` and
restarts the fetch cycle. This is how config changes (color scheme, filter
settings, etc.) trigger a full refetch.

Watching what the method returns rather than the call itself is deliberate:
building the payload usually reads far more observables than it returns — a
whole config snapshot, or a value that was itself fetched — and tracking the
call would refetch on every one of them. Two consequences to design around:

- Only fields that reach the **return** are cache keys. A value merely consulted
  while building the payload invalidates nothing.
- `JSON.stringify` is the comparison, so a field whose distinct states serialize
  the same way is a dead cache axis that fails silently. An `undefined` drops
  its key entirely, and a class instance without a `toJSON` flattens to `{}`.
  Prefer primitives and plain arrays.

It goes in a `.views()` block, and holds only the settings the worker reads:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts#rpcProps -->

```ts
// fetch inputs watched by SettingsInvalidate; any change refetches. Put
// settings that change what the worker computes here; never scroll/zoom
// (those change every frame) or the fetch results themselves.
rpcProps() {
  return { scoreColumn: getConf(self, 'scoreColumn') }
},
```

**Do not include** values that change every frame (scroll position, zoom level).
Those belong in `renderState` (for GPU displays) or re-read inside the work
callback. Putting them in `rpcProps` causes a refetch on every pixel of scroll.

**Do not include** the fetch results themselves. Putting derived cell data or
computed arrays in `rpcProps` creates an infinite fetch loop because storing
results triggers another settings change.

If you need to extend a parent class's `rpcProps`, capture the super version
before redefining it (the same
[super-capture pattern](/docs/developer_guides/mst_patterns#self-over-this-in-views)
used for any extended view) so you don't silently drop the parent's
dependencies.

## Byte estimation and regionTooLarge

Displays that fetch potentially large files can ask the adapter how many bytes a
region would download, and hold off the fetch when that is over budget. Opt in
with one getter:

<!-- include: plugins/alignments/src/LinearAlignmentsDisplay/model.ts#byteGate -->

```ts
/**
 * #getter
 * Opt into RegionTooLargeMixin's byte gate: `fetchRegions` measures the
 * region set with `CoreGetRegionByteEstimate` before downloading reads.
 */
get byteGateEnabled() {
  return true
},
/**
 * #getter
 * Keep gating below `AUTO_FORCE_LOAD_BP`. The floor's premise is "a small
 * span is a small fetch", and depth breaks it exactly as row count breaks
 * it for MAF: reads cost ~coverage bytes per reference base, so an
 * amplicon panel, a mitochondrial pileup or a targeted deep-sequencing
 * run is tens of MB inside a gene-sized window. The floor declined to
 * look at precisely that fetch.
 *
 * **This blocks nothing that previously worked at every zoom.** The
 * estimate comes from the BAI/CRAI, and a wider query overlaps a superset
 * of index bins, so it is monotone non-decreasing in span: a region whose
 * estimate clears the cap below the floor cleared it at 20kb too. Every
 * file this newly stops is therefore one that already banners the moment
 * you zoom out past 20kb — the floor was a way to *bypass* that verdict by
 * zooming in, which downloaded the same bytes the gate had just refused.
 *
 * No coverage threshold is needed to make this safe for ordinary data:
 * the estimate is still what gets compared against the adapter's
 * `fetchSizeLimit` (5 Mb for BAM, 3 Mb for CRAM), and a 30x genome at
 * gene zoom is far under it.
 */
get gateBelowForceLoadFloor() {
  return true
},
```

`fetchRegions` then calls `CoreGetRegionByteEstimate` before your work callback.
When the estimate for the visible span exceeds the byte limit (the adapter's own
`fetchSizeLimit`, else the display config's), the fetch is skipped and
`DisplayChrome` shows the too-large banner with a "Force load" button.

Two things fall out of that for free:

- `regionTooLarge` is **derived**, not a flag: it rescales the stored estimate
  to the span on screen right now, so the banner releases itself as soon as you
  zoom in far enough, and doesn't flicker while you pan.
- "Force load" sets one volatile boolean for the whole track (`forceLoadTrack`),
  so the user approves a track once, with its size quoted in front of them,
  rather than re-approving each locus. The declarative equivalent is the
  `forceLoad` config slot.

Regions under 20 kb never gate, and adapters that summarize at screen resolution
(BigWig, HiC, sequence) are exempt for free: they report no byte estimate, and
no estimate means no byte axis in the verdict.

A display that fetches outside `fetchRegions` calls the same gate itself with
`if (await self.byteGateBlocksFetch(regions, ctx)) return` (see arc's
`fetchArcFeatures`, which fetches through `GlobalFetchMixin` rather than
`MultiRegionDisplayMixin`'s `fetchRegions`).

## FetchMixin: cancellation and staleness

`MultiRegionDisplayMixin` composes `FetchMixin`, which owns the stop-token
lifecycle. Each call to `fetchRegions()` rotates the stop token:

- A new unique `stopToken` is created and captured as `activeStopToken`
- The prior token is signaled to stop (any in-flight adapter calls abort)
- `fetchGeneration` is captured at the start of the fetch
- `isStale()` returns `true` if `fetchGeneration` has advanced since the token
  was created (i.e. if a newer fetch has started)
- On completion (success or error), `fetchGeneration` increments once,
  re-triggering `FetchVisibleRegions` to check if anything still needs loading

`isLoading` is `true` while `activeStopToken !== undefined`.
`FetchVisibleRegions` guards against firing mid-fetch with
`untracked(() => self.isLoading)`, which reads the value without tracking it as
a reactive dependency.

## Composing the mixin

`MultiRegionDisplayMixin` supplies only the fetch/render lifecycle. Compose it
alongside `BaseDisplay` and `TrackHeightMixin`, which supply the display
identity and `height` respectively, then add the `rpcDataMap` volatile, the
`rpcProps` view and the `setRpcData`/`fetchNeeded` actions above.
`LinearScoreDisplay` in [](/docs/developer_guides/plotting_features) is that
model whole and compiling; read the composition there rather than from a
skeleton here.

## Full flow summary

```
visibleRegions changes → FetchVisibleRegions (600ms) → fetchNeeded(needed)
  → fetchRegions(needed, work):
      rotate stop token
      check byte estimate → regionTooLarge? stop here
      call work(ctx):
          rpcManager.call('MyRpcMethod', { ...rpcProps(), region, stopToken })
          if !ctx.isStale(): setRpcData(regionIndex, result)
      increment fetchGeneration
  → FetchVisibleRegions re-fires → nothing needed → done
```

## See also

- [Architecture spec: data fetching pipeline](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#data-fetching-pipeline)
- [](/docs/developer_guides/creating_gpu_display)
- [](/docs/developer_guides/rpc_workers)
- [](/docs/developer_guides/mst_patterns)
- [](/docs/developer_guides/creating_display)

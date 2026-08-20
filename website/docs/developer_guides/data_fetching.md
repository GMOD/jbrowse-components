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

`installPerRegionFetchAutoruns` installs four autoruns:

<!-- prettier-ignore -->
| Autorun | Fires on | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` changes | `clearAllRpcData()` **+ `clearByteEstimate()`** — one of the two places the cached byte estimate is dropped (the other is a tier swap) |
| `FetchVisibleRegions` | the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry (debounced 600 ms) | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized |
| `SettingsInvalidate` | `rpcPropsCacheKey`, the serialized `rpcProps()` return | `clearAllRpcData()`. Installed only when the display defines `rpcProps()` |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself |

<!-- FETCH_AUTORUNS END -->

`clearAllRpcData()` cancels the in-flight fetch, clears `error` and
`loadedRegions`, resets the canvas-drawn flag, and calls
`clearDisplaySpecificData()` — the hook your display overrides to drop its own
`rpcDataMap`. Cancelling bumps `fetchGeneration`, which re-fires
`FetchVisibleRegions` to start fresh fetches.

It deliberately leaves the too-large gate alone. `regionTooLarge` is derived
from the cached byte estimate, which a blocked display re-takes once per settled
viewport, so it releases itself and needs no imperative clear; keeping the
estimate is what stops the banner flickering on an ordinary clear.

## The whole chain

<Figure caption="The too-large gate is self-releasing: nothing clears the banner, and a blocked display re-measures at each settled viewport until the window is small enough to fetch. That is the second of the two returns the dashed edge carries." src="/img/fetch_chain.png" />

`isBlockCovered` compares the block against the loaded bounds, and those are
buffered wider than the viewport, so a small pan finds them still covering and
fetches nothing. `isCacheValid` is the override hook beside it, for a display
whose data goes stale for reasons the bounds can't see.

## Implementing fetchNeeded

`fetchNeeded` is the hook you override to make RPC calls. Reach for
`fetchEachRegion`, which runs one RPC per region in parallel over the
`fetchRegions(needed, work)` primitive and applies both `ctx.isStale()` guards
for you — forgetting either is a stale-data write, so it is a correctness
primitive rather than a convenience. `LinearScoreDisplay`'s is a whole one,
sitting in an `.actions(self => ({ ... }))` block:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts#fetchNeeded -->

```ts
// called by the fetch autorun for the regions that need loading;
// fetchEachRegion handles cancellation, stop tokens and staleness
fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
  // no `if (!adapterConfig)` guard: the `adapter` slot is a union of the
  // registered adapter schemas, all of which are creatable from an empty
  // snapshot, so MST always materializes an object there and the guard
  // could never fire
  const { adapterConfig } = self
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)
  return fetchEachRegion(self, needed, {
    // rpcManager.call injects sessionId from its first argument, so it
    // does not go in the args object
    call: (region, ctx) =>
      rpcManager.call(sessionId, 'GetScoreData', {
        adapterConfig,
        region,
        ...self.rpcProps(),
        stopToken: ctx.stopToken,
        // the RPC layer replaces this function with a side-channel and
        // calls it on the main thread as the worker reports progress.
        // It is this region's slot in the fetch's fan-out, so the N
        // parallel calls aggregate into one bar
        statusCallback: ctx.statusCallback,
      }),
    onResult: (idx, result) => {
      self.setRpcData(idx, result)
    },
  })
},
```

`call` keeps the literal RPC method name at the call site so its typed args and
return survive, and the `ctx` it receives is that region's own — its
`statusCallback` is the region's slot in a fan-out, so every region's progress
aggregates into one bar. A batched counterpart, `fetchAllRegions`, hands all
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
await self.fetchRegions(needed, async (ctx: RegionFetchContext) => {
  // The CDS-frame annotation overlay (when configured) fetches in the same
  // stop-token-guarded pass as the main data so the two share staleness +
  // loadedRegions book-keeping; the two RPCs run concurrently.
  //
  // Concurrently, and each is itself a per-region fan-out, so they get a slot
  // apiece rather than the shared callback: two fan-outs writing one status
  // field directly is last-writer-wins between them, and the annotation
  // branch's rows are a small fraction of the alignment's.
  const slot = createStatusFanOut(ctx.statusCallback)
  const [results] = await Promise.all([
    callEachRegion(needed, { ...ctx, statusCallback: slot() }, call),
    fetchAnnotationData(self, needed, { ...ctx, statusCallback: slot() }),
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
  // beside the store, and every region gets one: MAF's size gate is the
  // pre-flight kind, so a refusal returns from `fetchRegions` before this
  // callback runs at all and nothing here can arrive empty-handed.
  for (const { displayedRegionIndex } of needed) {
    ctx.commitRegion(displayedRegionIndex)
  }
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
get measuresBytesPreFlight() {
  return true
},
```

`fetchRegions` then calls `CoreGetRegionByteEstimate` before your work callback.
When the estimate for the visible span exceeds the byte limit (the adapter's own
`fetchSizeLimit`, else the display config's), the fetch is skipped and
`DisplayChrome` shows the too-large banner with a "Force load" button.

Two things fall out of that for free:

- `regionTooLarge` is **derived**, not a flag: it is a pure comparison of the
  last measurement against the budget. What keeps that measurement describing
  what you are looking at is that a blocked display keeps running its fetch,
  once per settled viewport — the fetch stops at the estimate, so it costs an
  index read and downloads nothing. So the banner releases itself on a fresh
  measurement, with no imperative clear and no flicker while you pan.
- "Force load" sets one volatile boolean for the whole track (`forceLoadTrack`),
  so the user approves a track once, with its size quoted in front of them,
  rather than re-approving each locus. The declarative equivalent is the
  `forceLoad` config slot.

The verdict has two axes and they stop gating for different reasons, which is
worth keeping straight:

- The **byte** axis drops out when the adapter offers no index estimate, which
  is how adapters that summarize at screen resolution (BigWig, HiC, sequence)
  cost nothing to support. It has no span floor — below `AUTO_FORCE_LOAD_BP` it
  keeps gating against a raised budget rather than switching off, so a
  gene-scale view of deep data loads while a pileup an order of magnitude
  heavier still asks.
- The **density** axis stops below `AUTO_FORCE_LOAD_BP` (20 kb) outright, since
  its number is extrapolated rather than measured at the span it judges.

"Exempt" in this mixin means force-loaded, not un-measurable — `gateExempt` is
`configForceLoad || forceLoadTrack` and lifts **both** axes.
[REGION_TOO_LARGE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REGION_TOO_LARGE.md)
is the full account, including the four bugs the predecessor had from an axis
name claiming a term it did not have.

A display that fetches outside `fetchRegions` calls the same gate itself in its
`run` phase, returning `undefined` — nothing to commit — when it blocks (see
arc's `arcFetchPhases`, which fetches through `GlobalFetchMixin` rather than
`MultiRegionDisplayMixin`'s `fetchRegions`).

## FetchMixin: cancellation and staleness

`MultiRegionDisplayMixin` composes [`FetchMixin`](/docs/models/fetchmixin),
which owns the stop-token lifecycle. Each `fetchRegions()` mints a fresh
`stopToken`, signals the previous one to stop so in-flight adapter calls abort,
and captures `fetchGeneration` as its staleness epoch.

That counter bumps once at every fetch **end** — success, error, or cancel — and
does two jobs with the one bump: `isStale()` compares it against the epoch, so
the superseded flow returns true and drops its results, and
`FetchVisibleRegions` reads it to re-evaluate once the fetch is over.
`isLoading` is `true` while `activeStopToken` is set, and the fetch autorun
reads it through `untracked(() => self.isLoading)` so guarding on it doesn't
make it a trigger.

## Composing the mixin

Compose it alongside `BaseDisplay` and `TrackHeightMixin`, then add the
`rpcDataMap` volatile, the `rpcProps` view and the `setRpcData`/`fetchNeeded`
actions above. `LinearScoreDisplay` in
[](/docs/developer_guides/plotting_features) is that model whole and compiling.

## See also

- [Architecture spec: data fetching pipeline](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#data-fetching-pipeline)
- [](/docs/developer_guides/dataflow)
- [](/docs/developer_guides/optimizations)
- [](/docs/developer_guides/creating_gpu_display)
- [](/docs/developer_guides/rpc_workers)
- [](/docs/developer_guides/mst_patterns)
- [](/docs/developer_guides/creating_display)

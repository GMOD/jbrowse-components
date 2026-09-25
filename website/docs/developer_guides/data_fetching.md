---
title: Data fetching pipeline
description:
  How MultiRegionDisplayMixin fetches data, the autorun chain, and rpcProps
guide_category: Core concepts
---

Most linear displays compose `MultiRegionDisplayMixin`, which installs the
autoruns that manage fetch lifecycle, cancellation, and cache invalidation. You
override `fetchNeeded` (usually via `fetchEachRegion`) and declare `rpcProps` as
the cache key. Understand this chain before writing a display or debugging an
unexpected refetch in any display.

Displays whose data isn't partitioned by region compose `GlobalFetchMixin`
instead and install a fetch autorun of their own. See
[display foundations](/docs/developer_guides/creating_display#display-foundations)
for which foundation each in-tree display uses.

## The fetch autoruns

<!-- FETCH_AUTORUNS START -->

`installPerRegionFetchAutoruns` installs four autoruns:

<!-- prettier-ignore -->
| Autorun | Fires on | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` changes | `clearAllRpcData()` |
| `SettingsInvalidate` | `settingsFetchInputs`, the `rpcProps()` return and the adapter config compared structurally | `invalidateSettings()`: supersede the in-flight fetch, clear a blocking error or cancel, drop settings-baked data. `loadedRegions` stays, so the held data draws under the `staleSettingsDrawn` scrim until the refetch lands |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself |
| `FetchVisibleRegions` | the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry (immediate, then debounced 600 ms) | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized |

<!-- FETCH_AUTORUNS END -->

`clearAllRpcData()`:

- cancels the in-flight fetch
- clears `error` and `loadedRegions`, which holds each region's payload
- resets the canvas-drawn flag
- calls `clearDisplaySpecificData()`, the hook a display overrides only where it
  holds something beside the store

Cancelling bumps `fetchGeneration`. That re-fires `FetchVisibleRegions`, which
starts fresh fetches.

<Figure caption="Three of the four autoruns end in the same cancel, by two routes. clearAllRpcData() discards the loaded data, and invalidateSettings() keeps it on screen under the scrim. The cancel bumps fetchGeneration, which triggers FetchVisibleRegions, so to explain an unexpected refetch, find which of the three autoruns ran. The diagram leaves out loaded data because the fetch autorun reads it untracked." src="/img/display_autoruns.png" />

`clearAllRpcData()` leaves the too-large gate alone. `regionTooLarge` is derived
from the cached byte estimate, and a blocked display re-takes that estimate once
per settled viewport. The gate therefore releases itself and needs no imperative
clear. Keeping the estimate stops the banner flickering on an ordinary clear.

## The whole fetch chain

<Figure caption="A blocked display re-measures at each settled viewport and fetches once the window is small enough, which clears the banner. The dashed edge carries that re-measurement as the second of its two returns." src="/img/fetch_chain.png" />

`isBlockCovered` compares the block against the loaded bounds. The loaded bounds
extend past the viewport, so after a small pan they still cover the block and
nothing is fetched. `isCacheValid` checks whether the data held for a region is
still valid for the current view, by comparing the whole fetch key; a display
does not override it. A display whose data goes stale for reasons the bounds
can't detect reports that through `zoomFetchArgs` (the zoom-derived arguments a
fetch now would send the worker, which the foundation stamps beside each region)
or `regionHasData` (whether what the last fetch stored still answers at this
zoom).

## Implementing fetchNeeded

`fetchNeeded` is the hook you override to make RPC calls. Use `fetchEachRegion`,
which runs one RPC per region in parallel over the `fetchRegions(needed, work)`
primitive. It applies both `ctx.isStale()` guards for you, and omitting either
guard writes stale data. `LinearScoreDisplay` has a complete `fetchNeeded`, in
an `.actions(self => ({ ... }))` block:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts#fetchNeeded -->

```ts
// called by the fetch autorun for the regions that need loading;
// fetchEachRegion handles cancellation and staleness
fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
  // no `if (!adapterConfig)` guard: the `adapter` slot is a union of the
  // registered adapter schemas, all of which are creatable from an empty
  // snapshot, so MST always materializes an object there and the guard
  // could never fire
  const { adapterConfig } = self
  return fetchEachRegion(self, needed, {
    // `ctx.callRpc`, never `rpcManager.call`: the context injects this
    // fetch's signal and its status callback, and forgetting either
    // is silent — no cancellation for this display, or no progress. The
    // callback here is this region's own slot in the fan-out, so the N
    // parallel calls aggregate into one bar instead of overwriting each
    // other
    call: (region, ctx) =>
      ctx.callRpc('GetScoreData', {
        adapterConfig,
        region,
        ...self.rpcProps(),
      }),
    // what a region stores; the foundation commits it with the region's
    // span and fetch inputs as one record
    onResult: (_idx, result) => result,
  })
},
```

`call` reaches the worker through **`ctx.callRpc`**, not `rpcManager.call`. The
context injects this fetch's signal and its status callback, so every RPC a
fetch issues is known to the cancel and the progress bar. If you pass them by
hand and forget one, nothing reports it: the display loses cancellation or
progress. The envelope keeps the literal method name at the call site, so the
registry's types for args and return still apply. Each region receives a
separate `ctx`, so every region's progress aggregates into one bar.

Put a batch-wide step that runs after every region has landed in `onComplete`.
It runs once, under the same staleness guard. Both canvas feature displays
commit their region-too-large measurements there. Those measurements must be
atomic across the batch, even though the payloads are not.

### The two batched counterparts

Reach past `fetchEachRegion` when the worker does not answer one payload per
region:

- **`fetchAllRegions`** hands all regions to a single RPC call that returns one
  result per region, `results[i]` paired with `needed[i]`. Use it when the
  adapter serves the whole set more efficiently in one pass. BigWig, for
  example, coalesces adjacent on-disk blocks across region boundaries, which N
  independent calls cannot do.
- **`fetchRegionsBatched`** is for a worker answer that covers every region and
  cannot be split, such as multi-sample variant's `cellData` or MAF's per-batch
  sample union. It makes one `call` and one `commit`, and marks every region
  loaded together. It takes the region list as an argument in place of the
  plan's `needed`, because a display using it picks its own set. The variant
  matrix lays columns out across the whole visible width, so a partial refetch
  has no meaning there.

MAF shows the second helper in use. Its per-region call, shared with its summary
tier, runs a second RPC concurrently under the same signal, and refuses the
batch on the first refusal. `fetchRegionsBatched` then applies one staleness
guard around the whole batch:

<!-- include: plugins/maf/src/LinearMafDisplay/fetchMafData.ts#rawFetchRegions -->

```ts
// The CDS-frame annotation overlay (when configured) fetches in the same
// signal-guarded pass as the main data so the two share staleness
// book-keeping; the two RPCs run concurrently.
//
// Concurrently, and each is itself a per-region fan-out, so they get a
// slot apiece rather than the shared callback: two fan-outs writing one
// status field directly is last-writer-wins between them, and the
// annotation branch's rows are a small fraction of the alignment's.
const slot = createStatusFanOut(ctx.statusCallback)
const scope = refusalScope(ctx)
const [results, frames] = await Promise.all([
  callEachRegion(
    regions,
    { ...scope.ctx, statusCallback: slot() },
    (region, regionCtx, displayedRegionIndex) =>
      scope.guard(() => call(region, regionCtx, displayedRegionIndex)),
  ).then(landed),
  withFrames
    ? fetchAnnotationData(self, regions, {
        ...scope.ctx,
        statusCallback: slot(),
      })
    : NO_FRAMES,
])
// The batch's own byte number, whichever way it goes: the budget is what
// one region may cost, so the largest is what was judged and what the
// banner quotes.
//
// `partial` travels with it: the first refusal aborts the siblings, so a
// refused batch's largest is the largest among the regions that reported.
const perRegionBytes = results.map(r => measuredBytes(r.result))
const bytes = largestRegionBytes(perRegionBytes)
const partial = results.length < regions.length
const kept: MafBatch<R>['results'] = []
let refused = false
for (const { displayedRegionIndex, result } of results) {
  if (isRegionRefused(result)) {
    refused = true
  } else {
    kept.push({
      displayedRegionIndex,
      result,
      frames: frames.byIndex.get(displayedRegionIndex),
    })
  }
}
return refused
  ? { regionTooLarge: true as const, bytes, partial }
  : { results: kept, bytes, partial, framesRefused: frames.refused }
```

`ctx.isStale()` returns `true` if the user panned/zoomed or settings changed
while the fetch was in flight. The three helpers differ only in where they place
that check. With a check per region, results commit as they arrive. With one
check around the batch, as above, a cross-region decision never sees a
half-superseded set. `fetchRegions` is the primitive under all three helpers,
and no display calls it directly. A display that did would have to write both
guards and the `ctx.commitRegion` call beside its store by hand, and the helpers
prevent the bugs that come from getting those wrong.

## rpcProps: the cache key

`SettingsInvalidate` watches the settings tier of `fetchInputs`, which is the
**return value** of `rpcProps()` plus the adapter config, held in a structural
computed. When that value changes, every loaded region's `fetchInputs` stamp is
stale, and the autorun calls `invalidateSettings()`. That call supersedes the
in-flight fetch and clears a blocking error. The display also drops any data it
cannot correctly draw under the new setting (`clearSettingsBakedData`). The
fetch cycle then restarts while the held data stays on screen under the loading
scrim. Config changes (color scheme, filter settings, etc.) trigger a full
refetch this way.

The autorun watches the method's return value, not the reads inside it. Building
the payload usually reads far more observables than it returns, such as a whole
config snapshot or a value that was itself fetched, and tracking the call would
refetch whenever any of them changed. That has two consequences:

- Only fields that reach the **return** are cache keys. A value merely consulted
  while building the payload invalidates nothing.
- The comparison is structural, so an `undefined` field and a class instance
  with no own fields are distinct states.

`rpcProps` goes in a `.views()` block and returns only the settings the worker
reads:

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
Those belong in `renderState` or re-read inside the work callback. Putting them
in `rpcProps` causes a refetch on every pixel of scroll.

**Do not include** the fetch results themselves. Putting derived cell data or
computed arrays in `rpcProps` creates an infinite fetch loop because storing
results triggers another settings change.

To extend a parent class's `rpcProps`, capture the super version before
redefining it, with the same
[super-capture pattern](/docs/developer_guides/mst_patterns#self-over-this-in-views)
used for any extended view. Otherwise the override drops the parent's
dependencies, and nothing reports it.

## Byte estimation and regionTooLarge

Displays that fetch potentially large files can ask the adapter how many bytes a
region would download, and hold off the fetch when that is over budget. Opt in
with one getter:

<!-- include: plugins/alignments/src/LinearAlignmentsDisplay/model.ts#byteGate -->

```ts
/**
 * #getter
 * Opt into RegionTooLargeMixin's byte gate: `fetchNeeded` passes
 * `resolvedByteLimit()` to `RenderAlignmentData`, whose first await is
 * the index estimate — so an over-budget region is refused before a
 * single read is downloaded.
 */
get gateEnabled() {
  return true
},
```

...and one argument at the fetch: pass `byteLimit: self.resolvedByteLimit()` in
your RPC's args. The worker's first await then reads the adapter's index
estimate. When the estimate exceeds the byte limit (the adapter's
`fetchSizeLimit`, else the display config's), the worker returns a
`RegionTooLargeResult` in place of a payload and downloads nothing. The fan-out
helpers commit that measurement and skip the store and `loadedRegions` for the
refused region. `DisplayChrome` then shows the too-large banner with a "Force
load" button.

The byte gate has two consequences:

- `regionTooLarge` is **derived**, not a flag. It compares the last measurement
  against the budget. A blocked display keeps running its fetch once per settled
  viewport, so the measurement stays current for the region in view. The fetch
  stops at the measurement, so it costs an index read and downloads nothing. The
  banner then releases itself on a fresh measurement, with no imperative clear
  and no flicker while you pan.
- "Force load" sets one volatile boolean for the whole track (`forceLoadTrack`).
  The user approves a track once, with its size shown, and that approval covers
  every locus. The declarative equivalent is the `forceLoad` config slot.

The gate judges on two axes, and each stops gating for a different reason:

- The **byte** axis drops out when the adapter offers no index estimate.
  Adapters that summarize at screen resolution (BigWig, HiC, sequence) therefore
  need no work to support. The byte axis has no span floor. Below
  `AUTO_FORCE_LOAD_BP` it keeps gating against a raised budget, so a gene-scale
  view of deep data loads while a pileup an order of magnitude heavier still
  asks.
- The **density** axis stops below `AUTO_FORCE_LOAD_BP` (20 kb) outright,
  because its number is extrapolated from a measurement at a different span.

"Exempt" in this mixin means force-loaded. `gateExempt` is
`configForceLoad || forceLoadTrack` and lifts **both** axes.
[REGION_TOO_LARGE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REGION_TOO_LARGE.md)
is the full account, including the four bugs the predecessor had from an axis
name claiming a term it did not have.

No display calls the gate by hand. Both fetch runners call it: the three helpers
in `fetchEachRegion.ts` (`fetchEachRegion`, `fetchAllRegions`,
`fetchRegionsBatched`) for this family, and `installGlobalFetchAutorun`'s shared
phases for the global family. A display outside the per-region chain therefore
opts in with the same getter and nothing else. The commit side is shared too.
`nextGateState(prev, event)` holds the rules about _order_: which of two
measurements wins, what a clear leaves behind, and what a force-load approval
outlives. An exhaustive truth table over states cannot express those rules.

## FetchMixin: cancellation and staleness

`MultiRegionDisplayMixin` composes [`FetchMixin`](/docs/models/fetchmixin),
which owns the abort lifecycle. Each `fetchRegions()` mints a fresh
`AbortController`, aborts the previous one so in-flight adapter calls abort, and
captures `fetchGeneration` as its staleness epoch.

`fetchGeneration` bumps when a **current** fetch ends, on success or error. A
superseded run does not bump it on behalf of the run that replaced it. It also
bumps on the internal `cancelFetch` reset. The user-facing `cancelFetchByUser`
does not bump it, so a user's cancel stays in effect. `FetchVisibleRegions`
reads the counter to re-evaluate once the fetch is over. Staleness itself comes
from the abort rotation's `isCurrent`, not from this counter.

`isLoading` is `true` while `activeSignal` is set. The fetch autorun reads it
through `untracked(() => self.isLoading)`, so guarding on it doesn't make it a
trigger.

`FetchMixin` also owns `reloadCounter`, the "go again" signal. `reload()` bumps
it, and every fetch autorun reads it unconditionally, above its bail-outs. After
an error the other inputs are unchanged, so without `reloadCounter` nothing
would wake the fetch. `FetchMixin` holds it because both LGV fetch foundations
compose `FetchMixin`. A display that overrides `reload()` should still bump it.

## Prerequisite fetches

Some displays need one more thing before the viewport fetch can ask for
anything, such as the `.hic` file's binsize list or the sample list a
multi-sample VCF draws rows from. That read is **per adapter, not per
viewport**, so it cannot use the autoruns above. Watching `fetchGeneration`
would re-read the header on every pan.

Use
`installFetch(self, { report, prepare, run, commit, setError, delay, name })`
(`@jbrowse/core/util/installFetch`) for it. Every fetch outside the two display
foundations runs on the same skeleton. It enforces the rules below, each of
which some hand-rolled display fetch had missed:

- **latest-wins.** A reload-overlapped pair of reads must not commit in whatever
  order they resolve.
- **the error rule.** Only a _current_ run's real failure is published, so a
  superseded run's teardown cannot overwrite the error slot its successor owns.
- **the trigger list.** `reloadCounter` is read unconditionally, above every
  gate, so Retry re-runs the body even from a state where nothing else moved.
- **the leading edge.** First paint waits on this fetch, so it must not spend
  its whole debounce window on a cold open.

`prepare` runs synchronously inside the autorun body. What it reads to build the
call, the adapter config, is therefore tracked, and a change re-fires the read.
`run` makes the RPC through the same `ctx.callRpc` envelope and reads nothing
tracked. `commit` runs only while the run is still current. `setError` clears
the error at the start and publishes it on failure, so a display whose failure
has a second consequence handles that there. The sample-list scan also raises a
session notification, because a list that will not load leaves the band empty,
and nothing else on screen shows the failure. Pass no `contract`. The display's
foundation already installed the two display-contract checks, and the check
reports a second install as a double-attach.

The viewport fetch declines until the prerequisite lands, and reports that with
`awaitingPrerequisite`. That flag **defers** the retry verdict to the run after
the prerequisite arrives; it does not waive the verdict.

## Composing the mixin

Compose it alongside `BaseDisplay` and `TrackHeightMixin`, then add the
`rpcDataMap` getter over `regionPayloads`, the `rpcProps` view and the
`fetchNeeded` action above. `LinearScoreDisplay` in
[](/docs/developer_guides/plotting_features) is that model whole and compiling.

## See also

- [Architecture spec: data fetching pipeline](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#data-fetching-pipeline)
- [FETCH_KEYS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/FETCH_KEYS.md)
  — what invalidates a fetch, an upload and a frame
- [ZOOM_FETCH_KEYS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ZOOM_FETCH_KEYS.md)
  — what stales a region under zoom
- [](/docs/developer_guides/dataflow)
- [](/docs/developer_guides/optimizations)
- [](/docs/developer_guides/creating_gpu_display)
- [](/docs/developer_guides/rpc_workers)
- [](/docs/developer_guides/mst_patterns)
- [](/docs/developer_guides/creating_display)

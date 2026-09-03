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
compose `GlobalFetchMixin` and install their own fetch autorun. See
[display foundations](/docs/developer_guides/creating_display#display-foundations)
for which foundation each in-tree display uses.

## The fetch autoruns

<!-- FETCH_AUTORUNS START -->

`installPerRegionFetchAutoruns` installs four autoruns:

<!-- prettier-ignore -->
| Autorun | Fires on | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` changes | `clearAllRpcData()` |
| `SettingsInvalidate` | `rpcPropsCacheKey`, the serialized `rpcProps()` return, and `adapterConfigKey` | `invalidateSettings()`: supersede the in-flight fetch, clear a blocking error or cancel, drop settings-baked data. `loadedRegions` stays, so the held data draws under the `staleSettingsDrawn` scrim until the refetch lands |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself |
| `FetchVisibleRegions` | the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry (immediate, then debounced 600 ms) | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized |

<!-- FETCH_AUTORUNS END -->

`clearAllRpcData()`:

- cancels the in-flight fetch
- clears `error` and `loadedRegions`
- resets the canvas-drawn flag
- calls `clearDisplaySpecificData()`, the hook your display overrides to drop
  its own `rpcDataMap`

Cancelling bumps `fetchGeneration`, which re-fires `FetchVisibleRegions` to
start fresh fetches.

It deliberately leaves the too-large gate alone. `regionTooLarge` is derived
from the cached byte estimate, which a blocked display re-takes once per settled
viewport, so it releases itself and needs no imperative clear; keeping the
estimate is what stops the banner flickering on an ordinary clear.

## The whole fetch chain

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
primitive. `LinearScoreDisplay`'s is a whole one, sitting in an
`.actions(self => ({ ... }))` block:

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
  return fetchEachRegion(self, needed, {
    // `ctx.callRpc`, never `rpcManager.call`: the context injects this
    // fetch's stop token and its status callback, and forgetting either
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
    onResult: (idx, result) => {
      self.setRpcData(idx, result)
    },
  })
},
```

`call` reaches the worker through **`ctx.callRpc`**, not `rpcManager.call`: the
context injects this fetch's stop token and its status callback, so a fetch
cannot issue an RPC that the cancel and the progress bar do not know about.
Hand-threading them is silent when you forget — no cancellation for that
display, or no progress. The envelope keeps the literal method name at the call
site so the registry's typed args and return survive, and the `ctx` it receives
is that region's own, so every region's progress aggregates into one bar.

A batch-wide step after every region has landed goes in `onComplete`, which runs
once and under the same staleness guard — both canvas feature displays commit
their region-too-large measurements there, which is the one thing that has to be
atomic across a batch whose payloads are not.

### The two batched counterparts

Reach past `fetchEachRegion` when the worker does not answer one payload per
region:

- **`fetchAllRegions`** hands all regions to a single RPC call that returns one
  result per region, `results[i]` paired with `needed[i]`. Use it when the
  adapter serves the whole set in one pass more efficiently — BigWig coalesces
  adjacent on-disk blocks across region boundaries, which N independent calls
  cannot.
- **`fetchRegionsBatched`** is for a worker answer that covers every region and
  cannot be split: multi-sample variant's `cellData`, MAF's per-batch sample
  union. One `call`, one `commit`, and every region marked loaded together. The
  region list is its argument rather than the plan's `needed`, because a display
  on it picks its own set — the variant matrix lays columns out across the whole
  visible width, so a partial refetch has no meaning there.

MAF's is the worked case for the second, since it also runs a second RPC
concurrently under the same stop token, and takes one staleness guard around the
whole batch rather than per region:

<!-- include: plugins/maf/src/LinearMafDisplay/fetchMafData.ts#rawFetchRegions -->

```ts
type MafBatch = {
  results: { displayedRegionIndex: number; result: R }[]
  bytes?: number
}
await fetchRegionsBatched(self, needed, {
  // Annotated, because the two arms are what tells `fetchRegionsBatched`
  // which half is the payload: inferred, the marker's absent fields would
  // widen the payload's own.
  call: async (regions, ctx): Promise<MafBatch | RegionTooLargeResult> => {
    // The CDS-frame annotation overlay (when configured) fetches in the same
    // stop-token-guarded pass as the main data so the two share staleness +
    // loadedRegions book-keeping; the two RPCs run concurrently.
    //
    // Concurrently, and each is itself a per-region fan-out, so they get a
    // slot apiece rather than the shared callback: two fan-outs writing one
    // status field directly is last-writer-wins between them, and the
    // annotation branch's rows are a small fraction of the alignment's.
    const slot = createStatusFanOut(ctx.statusCallback)
    const scope = refusalScope(ctx)
    const results = await Promise.all([
      callEachRegion(
        regions,
        { ...scope.ctx, statusCallback: slot() },
        (region, regionCtx, displayedRegionIndex) =>
          scope.guard(() => call(region, regionCtx, displayedRegionIndex)),
      ),
      fetchAnnotationData(self, regions, {
        ...scope.ctx,
        statusCallback: slot(),
      }),
    ])
      .then(([answered]) => landed(answered))
      .finally(() => {
        scope.dispose()
      })
    // The batch's own byte number, whichever way it goes: the budget is what
    // one region may cost, so the largest is what was judged and what the
    // banner quotes.
    const perRegionBytes = results.map(r => measuredBytes(r.result))
    const bytes = largestRegionBytes(perRegionBytes)
    const kept: { displayedRegionIndex: number; result: R }[] = []
    let refused = false
    for (const { displayedRegionIndex, result } of results) {
      if (isRegionRefused(result)) {
        refused = true
      } else {
        kept.push({ displayedRegionIndex, result })
      }
    }
    return refused
      ? { regionTooLarge: true as const, bytes }
      : { results: kept, bytes }
  },
  commit: ({ results }) => {
    const sampleSet = unionSampleSets(results)
    if (sampleSet) {
      self.setSamples(sampleSet)
    }
    commit(results)
  },
})
```

`ctx.isStale()` returns `true` if the user panned/zoomed or settings changed
while the fetch was in flight. Where the check goes is the decision the helper
makes for you, and it is the only thing that separates them: per region, results
commit as they arrive; around the batch, as above, a cross-region decision can't
be made from a half-superseded set. `fetchRegions` itself is the primitive
underneath all three, and no display calls it directly — one that did would own
both guards and the `ctx.commitRegion` beside its own store by hand, which is
the class of bug the helpers exist to make unavailable.

## rpcProps: the cache key

`SettingsInvalidate` watches `rpcPropsCacheKey`, the **serialized return value**
of `rpcProps()`. When that string changes, every loaded region's fetch-key stamp
is stale, and the autorun calls `invalidateSettings()` — the in-flight fetch is
superseded, a blocking error is cleared, and the display drops any data it
cannot honestly draw under the new setting (`clearSettingsBakedData`) — so the
fetch cycle restarts while the held data stays on screen under the loading
scrim. This is how config changes (color scheme, filter settings, etc.) trigger
a full refetch.

What is watched is the method's return value: building the payload usually reads
far more observables than it returns — a whole config snapshot, or a value that
was itself fetched — and tracking the call would refetch on every one of them.
Two consequences to design around:

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
your RPC's args. The worker then reads the adapter's index estimate as the first
thing it awaits, and when that exceeds the byte limit (the adapter's own
`fetchSizeLimit`, else the display config's) it returns a `RegionTooLargeResult`
instead of a payload rather than downloading anything. The fan-out helpers
commit that measurement, skip the store and `loadedRegions` for the refused
region, and `DisplayChrome` shows the too-large banner with a "Force load"
button.

Two things fall out of that:

- `regionTooLarge` is **derived**, not a flag: it is a pure comparison of the
  last measurement against the budget. What keeps that measurement describing
  what you are looking at is that a blocked display keeps running its fetch,
  once per settled viewport — the fetch stops at the measurement, so it costs an
  index read and downloads nothing. So the banner releases itself on a fresh
  measurement, with no imperative clear and no flicker while you pan.
- "Force load" sets one volatile boolean for the whole track (`forceLoadTrack`),
  so the user approves a track once, with its size quoted in front of them, and
  that approval covers every locus. The declarative equivalent is the
  `forceLoad` config slot.

The verdict has two axes, and they stop gating for different reasons:

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

No display calls the gate by hand. Both fetch runners do it — the three helpers
in `fetchEachRegion.ts` (`fetchEachRegion`, `fetchAllRegions`,
`fetchRegionsBatched`) for this family and `installGlobalFetchAutorun`'s shared
phases for the global one — so a display outside the per-region chain opts in
with the same one getter and nothing else. The commit side is shared too:
`nextGateState(prev, event)` holds the rules about _order_ (which of two
measurements wins, what a clear leaves behind, what a force-load approval
outlives), because those are the ones an exhaustive truth table over states
cannot see.

## FetchMixin: cancellation and staleness

`MultiRegionDisplayMixin` composes [`FetchMixin`](/docs/models/fetchmixin),
which owns the stop-token lifecycle. Each `fetchRegions()` mints a fresh
`stopToken`, signals the previous one to stop so in-flight adapter calls abort,
and captures `fetchGeneration` as its staleness epoch.

That counter bumps when a **current** fetch ends (success or error — a
superseded run must not bump for the run that replaced it) and on the internal
`cancelFetch` reset; the user-facing `cancelFetchByUser` deliberately does not
bump, which is what makes that cancel durable. `FetchVisibleRegions` reads it to
re-evaluate once the fetch is over; staleness itself is the token rotation's
`isCurrent`, not this counter.

`isLoading` is `true` while `activeStopToken` is set, and the fetch autorun
reads it through `untracked(() => self.isLoading)` so guarding on it doesn't
make it a trigger.

`FetchMixin` also owns `reloadCounter`, the pure "go again" signal `reload()`
bumps and every fetch autorun reads unconditionally, above its bail-outs — after
an error each of the other inputs is unchanged, so nothing else would ever wake
the fetch. It lives here because it is the one mixin both LGV fetch foundations
compose; a display that overrides `reload()` should still bump it.

## Prerequisite fetches

Some displays need one more thing before the viewport fetch can ask for
anything: the `.hic` file's binsize list, the sample list a multi-sample VCF
draws rows from. That read is **per adapter, not per viewport**, so it cannot
ride the autoruns above — watching `fetchGeneration` would re-read the header on
every pan.

`installFetch(self, { report, prepare, run, commit, setError, delay, name })`
(`@jbrowse/core/util/installFetch`) is the shape for it — the same skeleton
every fetch outside the two display foundations runs on — and the rules it holds
are there because the displays that had hand-rolled the same fetch were each
missing a different one:

- **latest-wins.** A reload-overlapped pair of reads must not commit in whatever
  order they resolve.
- **the error rule.** Only a _current_ run's real failure is published, so a
  superseded run's teardown cannot overwrite the error slot its successor owns.
- **the trigger list.** `reloadCounter` is read unconditionally, above every
  gate, so Retry re-runs the body even from a state where nothing else moved.
- **the leading edge.** First paint waits on this fetch, so it must not spend
  its whole debounce window on a cold open.

`prepare` runs synchronously inside the autorun body, so what it reads to build
the call — the adapter config — is tracked and re-fires the read; `run` owns the
RPC through the same `ctx.callRpc` envelope and reads nothing tracked; `commit`
runs only while the run is still current. `setError` is both the clear at the
start and the publish on failure, so a display whose failure has a second
consequence says so there — the sample-list scan raises a session notification
too, because a list that will not load leaves the band empty rather than partial
and nothing else on screen would say so. Pass no `contract`: the display's own
foundation already installed the two display-contract checks, and a second
install is reported as the double-attach it exists to catch.

The viewport fetch then declines until the prerequisite lands, and says so with
`awaitingPrerequisite` — which **defers** the retry verdict to the run after it
arrives rather than waiving it.

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

---
title: Data fetching pipeline
description:
  How MultiRegionDisplayMixin fetches data, the autorun chain, and rpcProps
guide_category: Core concepts
---

Every linear display that fetches data composes `MultiRegionDisplayMixin`, which
installs five autoruns that collectively manage fetch lifecycle, cancellation,
and cache invalidation. Understanding this chain is essential for writing a
custom display that doesn't use the GPU path, and for debugging unexpected
refetches in one that does.

## The five autoruns

| Autorun                              | Fires on               | Action                                        |
| ------------------------------------ | ---------------------- | --------------------------------------------- |
| `DisplayedRegionsChange`             | `displayedRegions` ref | `clearAllRpcData()`                           |
| `FetchVisibleRegions`                | `visibleRegions`       | `fetchNeeded()` after a 600 ms delay          |
| `SettingsInvalidate`                 | `rpcProps()` fields    | `clearAllRpcData()`                           |
| `ClearBlockingStateOnViewportChange` | `visibleRegions`       | `clearAllRpcData()` if `regionTooLarge`/error |
| `ClearHoverOnRegionTooLarge`         | `regionTooLarge` set   | `onRegionTooLarge()` hook                     |

`ClearHoverOnRegionTooLarge` fires the overridable `onRegionTooLarge` hook when
the banner replaces the rendered content, so a lingering hover doesn't pin to a
now-hidden feature. It is a no-op unless your display overrides the hook.

`clearAllRpcData()` resets `rpcDataMap`, `loadedRegions`, `regionTooLarge`, and
`error`. It also bumps `fetchGeneration`, which causes `FetchVisibleRegions` to
re-fire and start fresh fetches.

## FetchVisibleRegions: the core fetch trigger

This autorun fires 600 ms after any change to the viewport. For each visible
region block it checks whether the data is already loaded and still valid:

```
view.visibleRegions changes
  ↓ (600ms delay)
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

`fetchNeeded` is the hook you override in your display to make RPC calls. The
mixin's primitive is `fetchRegions(needed, work)`, which handles cancellation,
stop tokens, and byte estimation. But most displays don't call it directly: they
use the `fetchEachRegion` wrapper, which runs one RPC per region in parallel and
applies the two `ctx.isStale()` guards for you. Forgetting either guard is a
stale-data write, so the wrapper is a correctness primitive, not just a
convenience. Prefer it:

```ts
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { fetchEachRegion } from '@jbrowse/plugin-linear-genome-view'

// Inside your display's .actions(self => ({ ... }))
async fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
  const { adapterConfig } = self
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)
  await fetchEachRegion(self, needed, {
    call: (region, ctx, displayedRegionIndex) =>
      rpcManager.call(sessionId, 'MyRpcMethod', {
        sessionId,
        adapterConfig,
        ...self.rpcProps(),
        region,
        stopToken: ctx.stopToken,
        statusCallback: self.makeRegionStatusCallback(displayedRegionIndex),
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
`ctx.isStale()` guards by hand:

```ts
import { getSession, isAlive } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)

  void self.fetchRegions(needed, async (ctx: FetchContext) => {
    await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }) => {
        const result = await rpcManager.call(sessionId, 'MyRpcMethod', {
          sessionId,
          adapterConfig: self.adapterConfig,
          ...self.rpcProps(),
          region,
          bpPerPx: view.bpPerPx,
          stopToken: ctx.stopToken,
          statusCallback: (msg: string) => {
            if (isAlive(self)) self.setStatusMessage(msg)
          },
        })

        if (!ctx.isStale()) {
          self.setRpcData(displayedRegionIndex, result)
        }
      }),
    )
  })
},
```

`ctx.isStale()` returns `true` if the user panned/zoomed or settings changed
while the fetch was in flight. Always check it before writing results to the
model, since stale writes trigger unnecessary re-renders. The
[architecture spec's data fetching pipeline](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#data-fetching-pipeline)
covers the byte gate, `regionTooLarge`, and the refetch-loop traps in depth.

## rpcProps: the cache key

`SettingsInvalidate` tracks every observable read inside `rpcProps()`. When any
of those values changes, it calls `clearAllRpcData()` and restarts the fetch
cycle. This is how config changes (color scheme, filter settings, etc.) trigger
a full refetch.

```ts
// Inside .views(self => ({ ... }))
rpcProps() {
  return {
    // Include every setting that changes what the worker computes.
    // Anything read here becomes a dependency of SettingsInvalidate.
    colorScheme: self.colorScheme,
    maxFeatures: readConfObject(self.configuration, 'maxFeatures'),
  }
}
```

**Do not include** values that change every frame (scroll position, zoom level).
Those belong in `renderState` (for GPU displays) or re-read inside the work
callback. Putting them in `rpcProps` causes a refetch on every pixel of scroll.

**Do not include** the fetch results themselves. Putting derived cell data or
computed arrays in `rpcProps` creates an infinite fetch loop because storing
results triggers another settings change.

If you need to extend a parent class's `rpcProps`, use the super-capture pattern
so you don't silently drop the parent's dependencies:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      return {
        ...superRpcProps(),
        myExtraField: self.myExtraField,
      }
    },
  }
})
```

## Byte estimation and regionTooLarge

Displays that fetch potentially large files can opt into byte estimation.
Override `getByteEstimateConfig()` to enable it:

```ts
getByteEstimateConfig(): ByteEstimateConfig | null {
  const view = getContainingView(self) as LinearGenomeViewModel
  return {
    adapterConfig: self.adapterConfig,
    fetchSizeLimit: 1_000_000,             // default limit in bytes
    userByteLimit: self.userByteLimit,  // set by force-load dialog
    visibleBp: view.visibleBp,
  }
}
```

When configured, `fetchRegions` calls `CoreGetRegionByteEstimate` before
invoking your work callback. If the estimate exceeds the limit, it sets
`regionTooLarge = true` and the UI shows a "zoom in" message. The user can
override by clicking "Force load", which calls `raiseForceLoadLimits()` to set
`userByteLimit` to the observed byte count.

`regionTooLarge` is automatically cleared when the user pans or zooms to a
different region, allowing a retry.

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
identity and `height` respectively:

```ts
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearMyDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        type: types.literal('LinearMyDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, MyData>(),
    }))
    .views(self => ({
      rpcProps() {
        return { adapterConfig: readConfObject(self.configuration, 'adapter') }
      },
    }))
    .actions(self => ({
      setRpcData(regionIndex: number, data: MyData) {
        self.rpcDataMap.set(regionIndex, data)
      },
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        // ... (see example above)
      },
    }))
}
```

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
- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
- [RPC and worker system](/docs/developer_guides/rpc_workers)
- [MST patterns](/docs/developer_guides/mst_patterns)
- [Creating custom display types](/docs/developer_guides/creating_display)

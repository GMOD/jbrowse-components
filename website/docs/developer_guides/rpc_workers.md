---
title: RPC and worker system
description: How to register and call RPC methods that run in web workers
guide_category: Core concepts
---

**TL;DR:** JBrowse runs data-intensive work — parsing adapters, computing
layouts, encoding GPU buffers — in web workers behind an RPC layer. Subclass
`RpcMethodType` with an `execute()`, register it with `addRpcMethod` in your
plugin's `install()`, and call it with `rpcManager.call(sessionId, name, args)`.
Only structured-clone-safe values cross the boundary.

## The RPC lifecycle

<Figure caption="One box per side of the boundary, with serializeArguments() and deserializeReturn() on the two crossings they act at. statusCallback stays on the main thread, and a side channel reports progress to it while execute() is still running." src="/img/rpc_lifecycle.png" />

Both hooks are yours to override. The serialize step is where refNames are
renamed and functions are stripped, which is why a method taking regions extends
a rename base rather than overriding it — see
[Renaming regions](#renaming-regions) below.

Sessions are sticky: a `sessionId` is pinned to one worker, so adapter caches
stay warm across calls from the same session.

## Implementing an RPC method

Extend `RpcMethodType` and implement `execute()`. `GetScoreData` from
[`example-plugins/score-example`](/docs/developer_guides/plotting_features) is a
complete one — it deserializes, resolves the adapter, fetches, and packs the
result into typed arrays:

<!-- include: example-plugins/score-example/src/ScoreRPC/GetScoreData.ts -->

```ts
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { buildScoreResult } from './buildScoreResult.ts'

import type { GetScoreDataArgs, ScoreRegionData } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// Registering the name here is what types `rpcManager.call(…, 'GetScoreData', …)`
// at every call site: the args are checked and the return type is inferred,
// instead of both being `any`.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetScoreData: {
      args: GetScoreDataArgs
      return: ScoreRegionData
    }
  }
}

export default class GetScoreData extends RpcMethodType<'GetScoreData'> {
  name = 'GetScoreData' as const

  async execute(args: RpcExecuteArgs<'GetScoreData'>) {
    const {
      sessionId,
      adapterConfig,
      region,
      scoreColumn,
      stopToken,
      statusCallback,
    } = args
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })
    // statusCallback arrives as an ordinary function: the caller's never
    // crossed the boundary, the RPC layer replaced it with a side channel and
    // rebuilt one here. Hand it to whatever does the slow work rather than only
    // bracketing that work, so the message tracks the download.
    statusCallback?.('Fetching features')
    const features = await dataAdapter.getFeaturesArray(region, {
      stopToken,
      statusCallback,
    })
    return buildScoreResult(features, scoreColumn)
  }
}
```

`deserializeArguments` comes first because it handles the blob map and the other
transport concerns; read the args off its result, not off the raw `args`.

### Renaming regions

If your method receives `Region` objects, their refNames are in the _assembly's_
naming scheme and the data adapter may use another (`chr1` vs `1`). Don't write
the `serializeArguments` override yourself — extend
`RpcMethodTypeWithRenameRegions`, which is that override:

<!-- include: packages/core/src/pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts -->

```ts
import RpcMethodType from './RpcMethodType.ts'

import type { RenameRegionsArgs } from './RpcMethodType.ts'

// Base for RPC methods whose serialize step just maps region refNames into the
// data adapter's naming scheme. Subclasses get region renaming for free;
// override serializeArguments only to add extra transforms, calling super to
// keep the renaming.
export default abstract class RpcMethodTypeWithRenameRegions<
  MethodName extends string = string,
> extends RpcMethodType<MethodName> {
  async serializeArguments<T extends RenameRegionsArgs>(args: T) {
    return super.serializeArguments(await this.renameRegions(args))
  }
}
```

There are two siblings for the shapes that differ:
`RpcMethodTypeWithRenameRegion` for a method taking a single `region` rather
than a `regions` array, and `RpcMethodTypeWithFiltersAndRenameRegions`, which
additionally deserializes a serialized filter chain. `CoreGetFeatures`,
`CoreGetRegionByteEstimate` and `CoreGetExportData` all use the plural one; the
MAF methods use the filtered one.

### Returning ArrayBuffers zero-copy

Wrap the result with `rpcResult` to transfer `ArrayBuffer`s instead of copying
them. The MAF alignment method returns several typed arrays this way:

<!-- include: plugins/maf/src/LinearMafGetAlignmentDataRpc/executeMafAlignmentData.ts#zeroCopy -->

```ts
const regionData: MafWireRegionData = { ...packed, coverage, refSampleId }
const result: LinearMafGetAlignmentDataResult = {
  samples,
  treeNewick,
  samplesCanonical: hasConfiguredSamples,
  regionData,
}
// second arg is the transfer list: these buffers are moved to the main
// thread, not structured-cloned. collectMafTransferables walks the result and
// gathers every ArrayBuffer in it — a fixed handful, because the wire is
// columnar; see that function for why the length of this list is what the
// whole shape is designed around.
return rpcResult(result, collectMafTransferables(regionData))
```

A transferred buffer is **neutered** in the worker — it has zero length there
afterwards. That is fine for a value you are returning and never touch again,
and a bug if the worker keeps it in a cache.

## Registering the method

`addRpcMethod` takes a factory, called once per realm — the main thread and each
worker construct their own instance:

<!-- include: example-plugins/score-example/src/ScoreRPC/index.ts -->

```ts
import GetScoreData from './GetScoreData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ScoreRPCF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => new GetScoreData(pluginManager))
}
```

Call that from your plugin's `install()`, alongside whatever else the plugin
registers:

<!-- include: example-plugins/score-example/src/index.ts -->

```ts
import Plugin from '@jbrowse/core/Plugin'

import LinearScoreDisplayF from './LinearScoreDisplay/index.ts'
import ScoreFeaturePanelF from './ScoreFeaturePanel/index.tsx'
import ScoreRPCF from './ScoreRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class ScoreExamplePlugin extends Plugin {
  name = 'ScoreExamplePlugin'

  install(pluginManager: PluginManager) {
    LinearScoreDisplayF(pluginManager)
    ScoreRPCF(pluginManager)
    ScoreFeaturePanelF(pluginManager)
  }
}
```

## Calling from the main thread

`getRpcSessionId(self)` is the sticky session id and
`getSession(self).rpcManager` dispatches. Note that `sessionId` is **not**
repeated inside the args object — `call` injects it from its first parameter.

Two fields work that way, and neither belongs in a registry entry: `sessionId`
(`RpcSession`) and the `stopToken`/`statusCallback` pair (`RpcHandles`). They
are properties of the _call_, so every method accepts them and no entry gets to
require or refuse one. `EntriesDeclaringCallLevelFields` in `RpcRegistry.ts`
fails compilation, naming the entry, if one declares either — both had spread
through the registry before it existed, and the handles reached production that
way: `CoreGetExportData` shipped with a Cancel button that did nothing.

A per-region display does not `await` the call itself. `fetchEachRegion` owns
cancellation, stop tokens and staleness, so `LinearScoreDisplay` hands it the
call and a place to put each result:

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

See [](/docs/developer_guides/data_fetching) for what `fetchEachRegion` does
with that, and [](/docs/developer_guides/plotting_features) for the rest of the
model. A one-off call — a dialog, a widget — needs none of it and can
`await rpcManager.call(...)` directly.

## What can cross the worker boundary

The worker boundary uses the [Structured Clone Algorithm][sca]. Safe types:

- Primitives: `string`, `number`, `boolean`, `null`, `undefined`
- `ArrayBuffer`, typed arrays (`Uint8Array`, `Float32Array`, …) - use the
  `rpcResult` transfer list to avoid copying
- `File`, `Blob`
- Plain objects and arrays (recursively)
- `Map`, `Set`, `Date`, `RegExp`

**Not safe**, filtered out automatically:

- Functions and callbacks - use the `statusCallback` mechanism below
- MST model nodes or observables
- Circular references

### Status callbacks

The RPC layer intercepts `statusCallback` props and channels them back to the
main thread, which is the one exception to "no functions cross the boundary" —
the function never actually goes; a side-channel does. The main-thread half is
the `statusCallback` in the call above, which a display reads off its
`FetchContext`. In a per-region fan-out that context is the region's own, so its
callback is that region's slot in the loading UI and the N of them aggregate
into one bar rather than clobbering each other.

In the worker it arrives deserialized and is called normally. Hand it down to
whatever does the slow work rather than only bracketing that work, so the
message tracks the download — `GetScoreData` above passes it into
`getFeaturesArray` for exactly that reason.

## Type-registering your method

The `declare module '@jbrowse/core/rpc/RpcRegistry'` block at the top of
`GetScoreData` above is what types `rpcManager.call` at every call site. Without
it both overloads fall back to `any`, so a misspelled arg or a wrong assumption
about the return type compiles. It goes in the file that defines the method, so
the two can't drift.

## Worker count and configuration

`workerCount` defaults to `0`, which means "decide from hardware":
`clamp(hardwareConcurrency - 1, 1, 5)`. Set it to pin a count instead:

```json
{
  "configuration": {
    "rpc": {
      "defaultDriver": "WebWorkerRpcDriver",
      "workerCount": 4
    }
  }
}
```

(Older sessions stored `workerCount` under a per-driver `drivers` map; that
shape is still read and hoisted to the flat slot on load.)

## See also

- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/creating_gpu_display)
- [](/docs/developer_guides/creating_adapter)
- [](/docs/developer_guides/refname_aliasing)

[sca]:
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm

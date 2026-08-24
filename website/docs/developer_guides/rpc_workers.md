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
a rename base — see [Renaming regions](#renaming-regions) below.

Sessions are sticky: a `sessionId` is pinned to one worker, so adapter caches
stay warm across calls from the same session.

## Implementing an RPC method

Extend `RpcMethodType` and implement `execute()`. `MafGetSequences` from
`plugins/maf` is a complete one: it declares its registry entry, resolves the
adapter, fetches, and post-processes the result. The base it extends adds region
renaming and feature filters on top of `RpcMethodType`, covered below. The
worked example in [](/docs/developer_guides/plotting_features) has no method
file of its own; `defineDisplay` builds one around the spec's `data` function.

<!-- include: plugins/maf/src/MafGetSequencesRpc/MafGetSequences.ts -->

```ts
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { processFeaturesToFasta } from '../util/processFeaturesToFasta.ts'

import type { BaseMafRpcArgs, Sample } from '../types.ts'
import type { FastaResult } from '../util/processFeaturesToFasta.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MafGetSequences: {
      args: MafGetSequencesArgs
      return: FastaResult
    }
  }
}

export interface MafGetSequencesArgs extends BaseMafRpcArgs {
  samples: Sample[]
  showAllLetters: boolean
  includeInsertions?: boolean
}

export default class MafGetSequences extends RpcMethodTypeWithFiltersAndRenameRegions<'MafGetSequences'> {
  name = 'MafGetSequences' as const

  async execute(args: RpcExecuteArgs<'MafGetSequences'>): Promise<FastaResult> {
    const {
      samples,
      regions,
      adapterConfig,
      sessionId,
      showAllLetters,
      includeInsertions,
    } = args
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    const features = await dataAdapter.getFeaturesArray(regions[0]!, args)
    return processFeaturesToFasta({
      features,
      samples,
      regions,
      showAllLetters,
      includeInsertions,
    })
  }
}
```

`deserializeArguments` comes first because it handles the blob map and the other
transport concerns; read the args off its result, not off the raw `args`.

### Renaming regions

If your method receives `Region` objects, their refNames are in the _assembly's_
naming scheme and the data adapter may use another (`chr1` vs `1`). Extend
`RpcMethodTypeWithRenameRegions`, which is that `serializeArguments` override:

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

Two siblings cover the shapes that differ:

- **`RpcMethodTypeWithRenameRegion`** for a method taking a single `region`
  rather than a `regions` array.
- **`RpcMethodTypeWithFiltersAndRenameRegions`**, which additionally
  deserializes a serialized filter chain; the MAF methods use it.

`CoreGetFeatures`, `CoreGetRegionByteEstimate` and `CoreGetExportData` all use
the plural base.

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
  bytes,
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

<!-- include: plugins/maf/src/MafGetSequencesRpc/index.ts -->

```ts
import MafGetSequences from './MafGetSequences.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafGetSequencesF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => {
    return new MafGetSequences(pluginManager)
  })
}
```

Call that from your plugin's `install()`, alongside whatever else the plugin
registers:

<!-- include: plugins/maf/src/index.ts -->

```ts
import Plugin from '@jbrowse/core/Plugin'

import BgzipMafAdapterF from './BgzipMafAdapter/index.ts'
import BgzipTaffyAdapterF from './BgzipTaffyAdapter/index.ts'
import BigMafAdapterF from './BigMafAdapter/index.ts'
import LinearMafClusterIdentityMatrixF from './LinearMafClusterIdentityRpc/index.ts'
import LinearMafDisplayF from './LinearMafDisplay/index.ts'
import LinearMafGetAlignmentDataF from './LinearMafGetAlignmentDataRpc/index.ts'
import LinearMafGetAnnotationDataF from './LinearMafGetAnnotationDataRpc/index.ts'
import LinearMafGetSummaryDataF from './LinearMafGetSummaryDataRpc/index.ts'
import MafAddTrackWorkflowF from './MafAddTrackWorkflow/index.ts'
import MafGetSequencesF from './MafGetSequencesRpc/index.ts'
import MafSequenceWidgetF from './MafSequenceWidget/index.ts'
import MafTabixAdapterF from './MafTabixAdapter/index.ts'
import MafTrackF from './MafTrack/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class MafPlugin extends Plugin {
  name = 'MafPlugin'

  install(pluginManager: PluginManager) {
    BgzipMafAdapterF(pluginManager)
    BgzipTaffyAdapterF(pluginManager)
    BigMafAdapterF(pluginManager)
    MafTrackF(pluginManager)
    LinearMafDisplayF(pluginManager)
    LinearMafClusterIdentityMatrixF(pluginManager)
    LinearMafGetAlignmentDataF(pluginManager)
    LinearMafGetAnnotationDataF(pluginManager)
    LinearMafGetSummaryDataF(pluginManager)
    MafTabixAdapterF(pluginManager)
    MafAddTrackWorkflowF(pluginManager)
    MafGetSequencesF(pluginManager)
    MafSequenceWidgetF(pluginManager)
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
fails compilation, naming the entry, if one declares either.

A per-region display does not `await` the call itself. `fetchEachRegion` owns
cancellation, stop tokens and staleness, so `LinearManhattanDisplay` hands it
the call and a place to put each result:

<!-- include: plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts#fetchNeeded -->

```ts
/**
 * #action
 */
fetchNeeded(
  needed: { region: Region; displayedRegionIndex: number }[],
) {
  const { adapterConfig } = self
  return fetchEachRegion(self, needed, {
    call: (region, ctx) =>
      ctx.callRpc('GetManhattanData', {
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

See [](/docs/developer_guides/data_fetching) for what `fetchEachRegion` does
with that, and `plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts`
for the rest of the model. A one-off call — a dialog, a widget — needs none of
it and can `await rpcManager.call(...)` directly.

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
into one bar.

In the worker it arrives deserialized and is called normally. Hand it down to
whatever does the slow work so the message tracks the download.
`MafGetSequences` above hands the whole deserialized `args` bag to
`getFeaturesArray`, so it and the stop token ride along.

## Type-registering your method

The `declare module '@jbrowse/core/rpc/RpcRegistry'` block at the top of
`MafGetSequences` above is what types `rpcManager.call` at every call site — and
`ctx.callRpc` with it, which forwards the same registry lookup, so a fetch gets
per-method arg inference and a typed return without naming the session id.
Without the registration both overloads fall back to `any`, so a misspelled arg
or a wrong assumption about the return type compiles. It goes in the file that
defines the method, so the two can't drift.

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

- [](/docs/developer_guides/dataflow)
- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/creating_gpu_display)
- [](/docs/developer_guides/creating_adapter)
- [](/docs/developer_guides/refname_aliasing)
- [PROGRESS_REPORTING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PROGRESS_REPORTING.md)
  — what the `statusCallback` above feeds: determinate bars, aggregation across
  concurrent fetches, and cancel

[sca]:
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm

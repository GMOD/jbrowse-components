import type { StatusCallback } from '../util/progress.ts'
import type { Feature } from '../util/simpleFeature.ts'
import type { StopToken } from '../util/stopToken.ts'
import type { NoAssemblyRegion } from '../util/types/index.ts'
import type { RpcResult } from './RpcServer.ts'

export interface RegionLike {
  refName: string
  start: number
  end: number
  assemblyName: string
}

export interface RpcRegistry {
  CoreGetRefNames: {
    args: {
      adapterConfig: Record<string, unknown>
      sequenceAdapter?: Record<string, unknown>
      assemblyName?: string
    }
    return: string[]
  }
  CoreGetRegions: {
    args: {
      adapterConfig: Record<string, unknown>
    }
    // a RegionsAdapter names refNames only — the assembly it belongs to is the
    // caller's context, not the adapter's, so no assemblyName comes back
    return: NoAssemblyRegion[]
  }
  CoreGetSequence: {
    args: {
      region: RegionLike
      adapterConfig: Record<string, unknown>
    }
    return: string | undefined
  }
  CoreGetFeatures: {
    args: {
      regions: RegionLike[]
      adapterConfig: Record<string, unknown>
      sequenceAdapter?: Record<string, unknown>
      opts?: Record<string, unknown>
    }
    return: Feature[]
  }
  CoreGetRegionByteEstimate: {
    args: {
      adapterConfig: Record<string, unknown>
      regions: RegionLike[]
      headers?: Record<string, string>
    }
    return: number | undefined
  }
  // A file header/metadata block is whatever the format carries — adapters
  // declare `getHeader`/`getMetadata` as `unknown` and callers narrow (a VCF
  // header arrives as a string, a hic header as an object). Claiming
  // `Record<string, unknown> | null` here read as a guarantee the worker never
  // made.
  CoreGetInfo: {
    args: {
      adapterConfig: Record<string, unknown>
    }
    return: unknown
  }
  CoreGetMetadata: {
    args: {
      adapterConfig: Record<string, unknown>
    }
    return: unknown
  }
  CoreGetExportData: {
    args: {
      regions: RegionLike[]
      adapterConfig: Record<string, unknown>
      formatType: string
      opts?: Record<string, unknown>
    }
    return: string
  }
  CoreFreeResources: {
    args: Record<string, unknown>
    return: void
  }
}

export type RpcMethodName = keyof RpcRegistry

export type RpcArgs<M extends RpcMethodName> = RpcRegistry[M]['args']

export type RpcReturn<M extends RpcMethodName> = RpcRegistry[M]['return']

/**
 * The caller's handles on an operation: how to stop it, and where it reports.
 *
 * Deliberately NOT part of any method's `args`. They are properties of the
 * call, not of the payload — every method can be cancelled and every method can
 * report — so they ride `rpcManager.call`'s fourth parameter and
 * `BaseRpcDriver.call` merges them into what the worker sees. A registry entry
 * that declares them is stating something it does not get to decide.
 *
 * They used to be per-entry, and the cost was not the 82 repeated lines: it was
 * that omitting them made a method silently uncancellable and silent, with the
 * call site still type-checking (an `...opts` spread suppresses the
 * excess-property check). `CoreGetExportData` shipped that way.
 */
export interface RpcHandles {
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

/**
 * What the two `RpcExecute*` derivations resolve to for a method name that was
 * written out but has no registry entry: a shape nothing satisfies, so the miss
 * is a compile error naming the method rather than silence.
 *
 * The silence was the problem. Both derivations are conditionals over `keyof
 * RpcRegistry`, and a name that misses falls out the bottom — where `unknown`
 * used to be. So `RpcMethodType<'GetFeatureDetails'>` type-checked with an
 * `execute` free to take and return anything at all. `GetFeatureDetails` is the
 * *class* name; the registry key beside it is `GetPileupFeatureDetails`, and
 * both classes called `GetFeatureDetails` (alignments, canvas) register under a
 * name their class does not carry — so the wrong guess is the natural one, and
 * an opt-in that silently opts you back out is worse than none, because it
 * reads as checked.
 *
 * Only for a name written out. The bare default `string` is the escape hatch
 * documented on {@link RpcMethodType} and still resolves to `unknown`;
 * `string extends M` is what tells the two apart.
 */
export interface NotInRpcRegistry<M extends string> {
  __rpcRegistryError: `no RpcRegistry entry for '${M}'`
}

/**
 * What a registered method's `execute` actually receives: its declared args,
 * plus the session it is pinned to, plus the handles the driver merged in.
 *
 * Derived rather than hand-written, for the reason {@link RpcExecuteReturn} is:
 * the return type has been checked against the registry for a while and the
 * args have not, which is the whole reason the two could drift. A method
 * parameterized with its own name (`RpcMethodType<'CoreGetSequence'>`) gets
 * both ends checked.
 */
export type RpcExecuteArgs<M extends string> = M extends RpcMethodName
  ? RpcArgs<M & RpcMethodName> & { sessionId: string } & RpcHandles
  : string extends M
    ? unknown
    : NotInRpcRegistry<M>

/**
 * What a CALLER passes to `rpcManager.call`: the method's own data, minus the
 * `sessionId` the layer injects, plus the {@link RpcHandles} every method takes.
 *
 * Exported and used by everything that types a `call` — `RpcManager` itself and
 * the structural `RpcMethodCaller` the clustering helpers take — because there
 * were three hand-written copies of this expression and the third one silently
 * lagged the other two the moment the handles moved.
 */
export type RpcCallArgs<M extends string> = M extends RpcMethodName
  ? Omit<RpcArgs<M & RpcMethodName>, 'sessionId'> & RpcHandles
  : Record<string, unknown> & RpcHandles

// What a registered method's `execute` may resolve to: the declared return, or
// that return wrapped in rpcResult to carry transferables. An RpcMethodType
// parameterized with its own name (`RpcMethodType<'CoreGetRegions'>`) gets its
// executor checked against the registry, so a registry entry can't drift from
// what the worker actually sends back. `string` (the default) resolves to
// `unknown`, leaving unparameterized methods unconstrained; a name that is not a
// key resolves to NotInRpcRegistry, which nothing satisfies.
export type RpcExecuteReturn<M extends string> = M extends RpcMethodName
  ? RpcReturn<M & RpcMethodName> | RpcResult<RpcReturn<M & RpcMethodName>>
  : string extends M
    ? unknown
    : NotInRpcRegistry<M>

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
  : unknown

// What a registered method's `execute` may resolve to: the declared return, or
// that return wrapped in rpcResult to carry transferables. An RpcMethodType
// parameterized with its own name (`RpcMethodType<'CoreGetRegions'>`) gets its
// executor checked against the registry, so a registry entry can't drift from
// what the worker actually sends back. `string` (the default) resolves to
// `unknown`, leaving unparameterized methods unconstrained.
export type RpcExecuteReturn<M extends string> = M extends RpcMethodName
  ? RpcReturn<M & RpcMethodName> | RpcResult<RpcReturn<M & RpcMethodName>>
  : unknown

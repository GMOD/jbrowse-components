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
      stopToken?: StopToken
      statusCallback?: StatusCallback
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
      stopToken?: StopToken
      statusCallback?: StatusCallback
    }
    return: string | undefined
  }
  CoreGetFeatures: {
    args: {
      regions: RegionLike[]
      adapterConfig: Record<string, unknown>
      sequenceAdapter?: Record<string, unknown>
      statusCallback?: StatusCallback
      stopToken?: StopToken
      opts?: Record<string, unknown>
    }
    return: Feature[]
  }
  CoreGetRegionByteEstimate: {
    args: {
      adapterConfig: Record<string, unknown>
      regions: RegionLike[]
      stopToken?: StopToken
      headers?: Record<string, string>
      statusCallback?: StatusCallback
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
      stopToken?: StopToken
      statusCallback?: StatusCallback
    }
    return: unknown
  }
  CoreGetMetadata: {
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: StopToken
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

// What a registered method's `execute` may resolve to: the declared return, or
// that return wrapped in rpcResult to carry transferables. An RpcMethodType
// parameterized with its own name (`RpcMethodType<'CoreGetRegions'>`) gets its
// executor checked against the registry, so a registry entry can't drift from
// what the worker actually sends back. `string` (the default) resolves to
// `unknown`, leaving unparameterized methods unconstrained.
export type RpcExecuteReturn<M extends string> = M extends RpcMethodName
  ? RpcReturn<M & RpcMethodName> | RpcResult<RpcReturn<M & RpcMethodName>>
  : unknown

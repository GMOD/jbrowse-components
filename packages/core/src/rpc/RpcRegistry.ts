import type { Feature } from '../util/simpleFeature.ts'
import type { Region } from '../util/types/index.ts'
import type { FeatureDensityStats } from '../data_adapters/BaseAdapter/types.ts'

export type RegionLike = { refName: string; start: number; end: number; assemblyName: string }

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RpcRegistry {
  CoreGetRefNames: {
    args: {
      adapterConfig: Record<string, unknown>
      sequenceAdapter?: Record<string, unknown>
      stopToken?: string
    }
    return: string[]
  }
  CoreGetRegions: {
    args: {
      adapterConfig: Record<string, unknown>
    }
    return: Region[]
  }
  CoreGetSequence: {
    args: {
      region: RegionLike
      adapterConfig: Record<string, unknown>
      stopToken?: string
    }
    return: string | undefined
  }
  CoreGetFeatures: {
    args: {
      regions: RegionLike[]
      adapterConfig: Record<string, unknown>
      statusCallback?: (arg: string) => void
      stopToken?: string
      opts?: unknown
    }
    return: Feature[]
  }
  CoreGetFeatureDensityStats: {
    args: {
      adapterConfig: Record<string, unknown>
      regions: RegionLike[]
      stopToken?: string
      headers?: Record<string, string>
    }
    return: FeatureDensityStats
  }
  CoreGetInfo: {
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
    }
    return: Record<string, unknown> | null
  }
  CoreGetMetadata: {
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
    }
    return: Record<string, unknown> | null
  }
  CoreGetExportData: {
    args: {
      regions: RegionLike[]
      adapterConfig: Record<string, unknown>
      formatType: string
      opts?: unknown
    }
    return: string
  }
  CoreFreeResources: {
    args: Record<string, unknown>
    return: void
  }
  CoreRender: {
    args: Record<string, unknown>
    return: unknown
  }
  CoreGetFeatureDetails: {
    args: Record<string, unknown>
    return: unknown
  }
}

export type RpcMethodName = keyof RpcRegistry

export type RpcArgs<M extends RpcMethodName> = RpcRegistry[M]['args']

export type RpcReturn<M extends RpcMethodName> = RpcRegistry[M]['return']

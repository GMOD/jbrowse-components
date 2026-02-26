import type { Feature } from '../util/simpleFeature.ts'
import type { Region } from '../util/types/index.ts'
import type { FeatureDensityStats } from '../data_adapters/BaseAdapter/types.ts'

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RpcRegistry {
  CoreGetRefNames: {
    args: {
      adapterConfig: Record<string, unknown>
      sequenceAdapter?: Record<string, unknown>
      stopToken?: string
      [key: string]: unknown
    }
    return: string[]
  }
  CoreGetRegions: {
    args: {
      adapterConfig: Record<string, unknown>
      [key: string]: unknown
    }
    return: Region[]
  }
  CoreGetSequence: {
    args: {
      region: Region
      adapterConfig: Record<string, unknown>
      stopToken?: string
      [key: string]: unknown
    }
    return: string | undefined
  }
  CoreGetFeatures: {
    args: {
      regions: Region[]
      adapterConfig: Record<string, unknown>
      statusCallback?: (arg: string) => void
      stopToken?: string
      opts?: unknown
      [key: string]: unknown
    }
    return: Feature[]
  }
  CoreGetFeatureDensityStats: {
    args: {
      adapterConfig: Record<string, unknown>
      regions: Region[]
      stopToken?: string
      headers?: Record<string, string>
      [key: string]: unknown
    }
    return: FeatureDensityStats
  }
  CoreGetInfo: {
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
      [key: string]: unknown
    }
    return: Record<string, unknown> | null
  }
  CoreGetMetadata: {
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
      [key: string]: unknown
    }
    return: Record<string, unknown> | null
  }
  CoreGetExportData: {
    args: {
      regions: Region[]
      adapterConfig: Record<string, unknown>
      formatType: string
      opts?: unknown
      [key: string]: unknown
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

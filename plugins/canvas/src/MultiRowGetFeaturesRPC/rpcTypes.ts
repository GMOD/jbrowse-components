import type { StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface MultiRowGetFeaturesArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  // start/end are integer bp (LGV's bufferedVisibleRegions already rounds).
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }
  // feature attribute whose value assigns each feature to a row
  partitionField: string
  // raw `color` config slot (a CSS color or `jexl:...`), evaluated per feature
  // in the worker against the feature
  colorConfig: string
  // optional map of partition value -> color; overrides colorConfig for any
  // feature whose partition value has an entry
  sampleColorMap?: Record<string, string>
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

export interface MultiRowGetFeaturesResult {
  featureStarts: Uint32Array
  featureEnds: Uint32Array
  featureColors: Uint32Array
  partitionValues: string[]
  featurePartitionIndex: Uint32Array
  // per-feature display name (feature `name` attribute), for hover tooltips
  featureNames: string[]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowGetFeatures: {
      args: MultiRowGetFeaturesArgs
      return: MultiRowGetFeaturesResult
    }
  }
}

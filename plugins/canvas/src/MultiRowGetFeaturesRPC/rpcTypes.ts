import type { RegionTooLargeResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
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
  // current zoom, so the byte/density gate can extrapolate a sampled density to
  // screen resolution the same way the feature-render RPC does
  bpPerPx: number
  // compressed-byte budget; a region whose index-only estimate exceeds it
  // short-circuits before any feature download. Undefined = no byte gate (below
  // the force-load zone, or force-loaded).
  byteSizeLimit?: number
  // max features-per-pixel; over it the region is too dense to render. Undefined
  // = no density gate (below the force-load zone, or force-loaded).
  maxFeatureDensity?: number
  // feature attribute whose value assigns each feature to a row
  partitionField: string
  // raw `color` config slot (a CSS color or `jexl:...`), evaluated per feature
  // in the worker against the feature. Per-row color (sampleColorMap / palette /
  // dialog) is applied on the main thread at render time, not here.
  colorConfig: string | undefined
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
  // per-feature adapter id, used to re-fetch the full feature on click (feature
  // details widget) via GetCanvasFeatureDetails
  featureIds: string[]
  // true when the `color` slot was left at its default and the features carried
  // an `itemRgb`, so featureColors came from the data rather than the default.
  // The main thread reads this to suppress the per-row palette, which would
  // otherwise paint over the colors the BED explicitly asked for.
  usedItemRgb: boolean
  // index-only byte estimate for the region (absent when the adapter has none),
  // and the fetched feature count — the main-thread gate maxes/re-derives both.
  bytes?: number
  featureCount?: number
}

// The region-too-large short-circuit (shared RegionTooLargeResult from the
// feature-render RPC): returned instead of the packed features when the byte or
// density gate trips, so no feature payload is downloaded/packed for a region the
// banner will replace. The densityGate helpers already return this type.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowGetFeatures: {
      args: MultiRowGetFeaturesArgs
      return: MultiRowGetFeaturesResult | RegionTooLargeResult
    }
  }
}

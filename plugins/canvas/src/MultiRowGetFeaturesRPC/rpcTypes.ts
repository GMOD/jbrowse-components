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
  // compressed-byte budget; a region whose index-only estimate exceeds it
  // short-circuits before any feature download. Undefined = no byte gate (below
  // the force-load zone, or force-loaded).
  //
  // Byte-only on purpose: multi-row paints into fixed lanes, so a high feature
  // count is a download cost, not a per-glyph render cost, and the display
  // turns the gate mixin's density axis off (`densityGateEnabled`). There is
  // deliberately no `maxFeatureDensity` here — re-enabling that axis has to
  // fail at this call site rather than silently pass an argument the worker
  // ignores. See agent-docs/reference/REGION_TOO_LARGE.md.
  byteLimit?: number
  // feature attribute whose value assigns each feature to a row
  partitionField: string
  // feature attribute holding a signed bp length change against the reference,
  // which turns on the indel-glyph pass. Empty string = off (no deltas packed).
  lengthField: string
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
  // signed bp length change per feature (the `lengthField` slot): positive is an
  // insertion the reference span understates, negative a deletion. **Length 0
  // when the slot is unset**, which is the render side's gate for the whole
  // indel-glyph pass — so read it as `featureDeltas.length === featureStarts
  // .length`, never as "index i is 0 so this feature has no indel" (0 is also a
  // legitimate reference-length allele).
  featureDeltas: Int32Array
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
// feature-render RPC): returned instead of the packed features when the byte
// gate trips, so no feature payload is downloaded/packed for a region the
// banner will replace.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowGetFeatures: {
      args: MultiRowGetFeaturesArgs
      return: MultiRowGetFeaturesResult | RegionTooLargeResult
    }
  }
}

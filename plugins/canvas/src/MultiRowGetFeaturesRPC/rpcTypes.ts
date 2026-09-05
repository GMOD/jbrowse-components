import type { RegionTooLargeResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { GatedFetchArgs } from '@jbrowse/core/rpc/byteBudget'
import type { LegendCandidate } from '@jbrowse/core/util/legendCandidates'

/**
 * This display gates on bytes only, so there is deliberately no
 * `maxFeatureDensity` here — adding a density axis has to fail at this call site
 * rather than pass an argument the worker ignores.
 */
export interface MultiRowGetFeaturesArgs extends GatedFetchArgs {
  adapterConfig: Record<string, unknown>
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }
  partitionField: string
  lengthField: string
  colorConfig: string | undefined
}

export interface PartitionCandidateValues {
  field: string
  values: string[]
  overflow: boolean
}

export interface MultiRowRegionData {
  featureStarts: Uint32Array
  featureEnds: Uint32Array
  featureColors: Uint32Array
  /**
   * Length 0 when the `lengthField` slot is unset, which gates the whole
   * indel-glyph pass — read it as `featureDeltas.length ===
   * featureStarts.length`, never as `deltas[i] === 0`, since 0 is a legitimate
   * reference-length allele.
   */
  featureDeltas: Int32Array
  partitionValues: string[]
  featurePartitionIndex: Uint32Array
  featureNames: string[]
  featureIds: string[]
  usedItemRgb: boolean
  partitionCandidates: string[]
  partitionCandidateValues: PartitionCandidateValues[]
  legendCandidates: LegendCandidate[]
  resolvedPartitionField: string
}

export interface MultiRowGetFeaturesResult extends MultiRowRegionData {
  bytes?: number
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowGetFeatures: {
      args: MultiRowGetFeaturesArgs
      return: MultiRowGetFeaturesResult | RegionTooLargeResult
      transferables: MultiRowGetFeaturesResult
    }
  }
}

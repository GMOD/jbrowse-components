import type { WorkerColor } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { RegionTooLargeResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FieldColorValues } from '../shared/fieldColorCandidates.ts'
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
  rowsField: string
  colorConfig: WorkerColor
}

/**
 * The color field's distinct values in one region, as text, and each value a
 * feature carries with the partition row it lands in (`rowIndex` indexes
 * `rowValues`), up to `MAX_LEGEND_CANDIDATES`.
 */
export type MultiRowColorValues = FieldColorValues

export interface RowsFieldCandidateValues {
  field: string
  values: string[]
  overflow: boolean
}

export interface MultiRowRegionData {
  featureStarts: Uint32Array
  featureEnds: Uint32Array
  featureColors: Uint32Array
  // Length 0 when no color field is named: each feature's one-based index
  // into `colorValues.values`, which the main thread paints through the scale
  // in `featureColors`' place.
  rectColorValues: Uint32Array
  colorValues?: MultiRowColorValues
  rowValues: string[]
  featureRowValueIndex: Uint32Array
  featureNames: string[]
  featureIds: string[]
  usedItemRgb: boolean
  // the attribute names a sample of the region's features carry
  fieldNames: string[]
  rowsFieldCandidateValues: RowsFieldCandidateValues[]
  legendCandidates: LegendCandidate[]
  resolvedRowsField: string
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

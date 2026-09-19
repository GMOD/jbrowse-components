import type { ZoomRange } from '@jbrowse/core/data_adapters/BaseAdapter/zoomRange'

export interface SourceInfo {
  name: string
  color?: string
  labelColor?: string
  label?: string
  group?: string
  baseUri?: string
}

// Display-ready per-feature typed arrays from the wiggle RPC. Single-source
// displays just have length-1 `sources`.
export interface WiggleFeatureArrays {
  featurePositions: Uint32Array
  featureScores: Float32Array
  featureMinScores: Float32Array
  featureMaxScores: Float32Array
  numFeatures: number
  hasSummaryScores: boolean
}

export type WiggleSourceData = SourceInfo & WiggleFeatureArrays

export interface WiggleDataResult {
  sources: WiggleSourceData[]
  zoomRange?: ZoomRange
}

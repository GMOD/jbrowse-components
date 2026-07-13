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
  posFeaturePositions: Uint32Array
  posFeatureScores: Float32Array
  posNumFeatures: number
  negFeaturePositions: Uint32Array
  negFeatureScores: Float32Array
  negNumFeatures: number
}

export type WiggleSourceData = SourceInfo & WiggleFeatureArrays

export interface WiggleDataResult {
  sources: WiggleSourceData[]
}

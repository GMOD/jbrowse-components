export interface WebGLMultiWiggleSourceData {
  name: string
  color: string
  featurePositions: Uint32Array // [start, end] pairs as offsets from regionStart
  featureScores: Float32Array
  numFeatures: number
  scoreMin: number
  scoreMax: number
}

export interface WebGLMultiWiggleDataResult {
  regionStart: number
  sources: WebGLMultiWiggleSourceData[]
  scoreMin: number
  scoreMax: number
}

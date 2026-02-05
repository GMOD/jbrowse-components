export interface WebGLWiggleDataResult {
  regionStart: number
  featurePositions: Uint32Array // [start, end] pairs as offsets from regionStart
  featureScores: Float32Array // score values
  numFeatures: number
  scoreMin: number
  scoreMax: number
}

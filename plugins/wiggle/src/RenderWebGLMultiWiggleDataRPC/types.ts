/**
 * WebGL Multi-Wiggle Data RPC Types
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * regionStart must be an integer (use Math.floor of view region start).
 * All position arrays store integer offsets from regionStart.
 */

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
  // Integer reference point for all positions (floor of view region start).
  // All position data in this result is stored as integer offsets from regionStart.
  regionStart: number
  sources: WebGLMultiWiggleSourceData[]
  scoreMin: number
  scoreMax: number
}

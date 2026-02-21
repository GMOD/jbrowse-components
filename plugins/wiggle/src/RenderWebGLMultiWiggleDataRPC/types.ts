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
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  posFeaturePositions: Uint32Array
  posFeatureScores: Float32Array
  posNumFeatures: number
  negFeaturePositions: Uint32Array
  negFeatureScores: Float32Array
  negNumFeatures: number
}

export interface WebGLMultiWiggleDataResult {
  // Integer reference point for all positions (floor of view region start).
  // All position data in this result is stored as integer offsets from regionStart.
  regionStart: number
  sources: WebGLMultiWiggleSourceData[]
}

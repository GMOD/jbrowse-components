/**
 * WebGL Wiggle Data RPC Types
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * regionStart must be an integer (use Math.floor of view region start).
 * All position arrays store integer offsets from regionStart.
 */

export interface WebGLWiggleDataResult {
  regionStart: number
  featurePositions: Uint32Array
  featureScores: Float32Array
  featureMinScores: Float32Array
  featureMaxScores: Float32Array
  numFeatures: number
  posFeaturePositions: Uint32Array
  posFeatureScores: Float32Array
  posNumFeatures: number
  negFeaturePositions: Uint32Array
  negFeatureScores: Float32Array
  negNumFeatures: number
}

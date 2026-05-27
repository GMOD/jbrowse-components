import type { WiggleDataResult } from './dataTypes.ts'

// Walks WiggleDataResult.sources once and returns each source's eight
// per-feature TypedArray buffers as a flat list for postMessage transfer.
// Field set matches WiggleFeatureArrays — when fields change there, update
// here so the buffers actually transfer instead of being structured-cloned.
//
// Buffers are deduped via a Set in case any source shares an underlying
// buffer (subarray slices in processFeaturesFromArrays don't, but it's cheap
// insurance).
export function collectWiggleTransferables(
  result: WiggleDataResult,
): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>()
  for (const s of result.sources) {
    buffers.add(s.featurePositions.buffer as ArrayBuffer)
    buffers.add(s.featureScores.buffer as ArrayBuffer)
    buffers.add(s.featureMinScores.buffer as ArrayBuffer)
    buffers.add(s.featureMaxScores.buffer as ArrayBuffer)
    buffers.add(s.posFeaturePositions.buffer as ArrayBuffer)
    buffers.add(s.posFeatureScores.buffer as ArrayBuffer)
    buffers.add(s.negFeaturePositions.buffer as ArrayBuffer)
    buffers.add(s.negFeatureScores.buffer as ArrayBuffer)
  }
  return [...buffers]
}

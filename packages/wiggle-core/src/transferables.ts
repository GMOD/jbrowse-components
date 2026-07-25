import type { WiggleDataResult } from './dataTypes.ts'

// Walks WiggleDataResult.sources once and returns each source's eight
// per-feature TypedArray buffers as a flat list for postMessage transfer.
// Field set matches WiggleFeatureArrays — when fields change there, update
// here so the buffers actually transfer instead of being structured-cloned.
//
// The Set dedupe is load-bearing, not insurance: processFeaturesFromArrays
// aliases fields onto one buffer whenever a copy would be identical (no summary
// data → min/max are the scores; an all-one-sided window → the pos or neg
// arrays are the full arrays). postMessage throws on a repeated transferable.
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

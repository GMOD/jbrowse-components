import type { WiggleDataResult } from './dataTypes.ts'

// Walks every result's sources once and returns each source's eight per-feature
// TypedArray buffers as one flat list for postMessage transfer. Field set
// matches WiggleFeatureArrays — when fields change there, update here so the
// buffers actually transfer instead of being structured-cloned.
//
// The Set dedupe is load-bearing, not insurance: processFeaturesFromArrays
// aliases fields onto one buffer whenever a copy would be identical (no summary
// data → min/max are the scores; an all-one-sided window → the pos or neg
// arrays are the full arrays). postMessage throws on a repeated transferable.
//
// It takes ALL the results rather than one, and that is the point — the RPC
// executors hand back a result per region, so a per-result Set only dedupes
// within a region and a buffer shared BETWEEN two regions would still be listed
// twice. Nothing shares across regions while processFeaturesFromArrays copies
// its inputs into fresh arrays, but that copy is exactly the thing worth
// removing: an adapter's arrays are already the right shape, and @gmod/bbi
// hands a one-region getFeaturesAsArraysMulti back as views into a single
// buffer. Aliasing them instead of copying would make cross-region sharing the
// normal case, and the throw it produced would be a mystery at the postMessage
// rather than at the aliasing. Deduping over the whole set costs nothing and
// keeps that refactor from having to remember this.
export function collectWiggleTransferables(
  results: WiggleDataResult[],
): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>()
  for (const result of results) {
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
  }
  return [...buffers]
}

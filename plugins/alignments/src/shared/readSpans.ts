import { medianOf } from './insertSizeStats.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

/**
 * How long the alignments in view are, in bp, at the median — the one number
 * that separates a library which can describe a rearrangement from one that
 * cannot. `readPositions` is the read's true alignment span rather than the
 * drawn geometry, so this is what the aligner placed and not what the window
 * cropped.
 *
 * The lanes are `rawDataByGroup.values()`, the same input `computeReadChains`
 * takes, and one record is one entry: a read the aligner split into three
 * supplementary alignments contributes three spans, which is right for a
 * question about how much reference a single alignment covers.
 *
 * 0 when nothing is loaded, which is the caller's own `hasReadsForDerivativePaths`
 * said a different way — a window over the track's byte budget draws `force load`
 * and has fetched nothing to measure.
 */
export function medianReadSpan(
  lanes: Iterable<ReadonlyMap<number, WorkerPileupData>>,
) {
  const perLane = [...lanes].flatMap(lane => [...lane.values()])
  const total = perLane.reduce((n, d) => n + d.readPositions.length / 2, 0)
  if (!total) {
    return 0
  }
  // Int32Array rather than the JS array a `flatMap` would build: a span outgrows
  // neither int32 nor a chromosome, and it is the element type `sortedCopy`
  // sorts without a comparator (see there for the 4.5x that buys at pileup
  // depth).
  const spans = new Int32Array(total)
  let i = 0
  for (const { readPositions } of perLane) {
    for (let r = 0; r < readPositions.length; r += 2) {
      spans[i++] = readPositions[r + 1]! - readPositions[r]!
    }
  }
  return medianOf(spans)
}

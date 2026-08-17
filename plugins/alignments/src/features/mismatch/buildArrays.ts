import { positionOrder } from '@jbrowse/alignments-core'

import type { MismatchData } from '../../shared/webglRpcTypes.ts'

/**
 * The per-mismatch parallel arrays, emitted in ASCENDING POSITION ORDER.
 *
 * The order is a contract, not an incidental. Every per-hover reader of these
 * arrays — `findSignificantInBin` from the coverage hit test, then
 * `countSnpsAtPosition` from the tooltip — wants the handful of entries under the
 * cursor, twice per mousemove per block per stacked track. Sorted here, in the
 * worker, that is a `lowerBound` on the shipped array and nothing else: no side
 * index, no memo, and no bytes retained on the main thread. `mismatchOrder.test
 * .ts` pins it, and MAF's producer (`MismatchWriter`, which walks columns and
 * then rows) satisfies the same contract by construction.
 *
 * `positionOrder` is the sort, shared with `positionIndex.ts` rather than
 * restated — including its sparse fallback, which matters here: `filtered` is
 * bounded by the REGION, and at whole-chromosome scale a bp-indexed histogram
 * over that span would allocate hundreds of megabytes to sort a handful of
 * entries.
 *
 * No `mismatchYs`: rows are `PileupLayoutArrays`, built main-thread (ADR-053) by
 * `remapYs` from `mismatchReadIndices`. It therefore inherits this permutation
 * through the array it derives from, and must never be permuted separately.
 */
export function buildMismatchArrays(
  mismatches: MismatchData[],
  regionStart: number,
) {
  const filtered = mismatches.filter(mm => mm.position >= regionStart)
  const n = filtered.length
  const raw = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    raw[i] = filtered[i]!.position
  }
  // `sorted` IS the shipped positions array — the sort already produced it, so
  // permuting positions a second time would be redundant work.
  const { order, sorted: mismatchPositions } = positionOrder(raw)
  const mismatchBases = new Uint8Array(n)
  const mismatchStrands = new Int8Array(n)
  const mismatchReadIndices = new Uint32Array(n)
  // Per-base Phred quality, already a byte from the BAM/CRAM QUAL array. 0 = no
  // quality, which the fade-by-quality renderers read as fully opaque.
  const mismatchQuals = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const mm = filtered[order[i]!]!
    mismatchBases[i] = mm.base
    mismatchStrands[i] = mm.strand
    mismatchReadIndices[i] = mm.readIndex
    mismatchQuals[i] = mm.qual
  }
  return {
    mismatchPositions,
    mismatchBases,
    mismatchStrands,
    mismatchReadIndices,
    mismatchQuals,
  }
}

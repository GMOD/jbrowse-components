import { passesFrequencyGate } from '../../LinearAlignmentsDisplay/constants.ts'
import { findTopmostOnRow } from '../../shared/hitTestTypes.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

export function hitTestMismatch(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const { basePos, row, bpPerPx } = coords
  const {
    mismatchPositions,
    mismatchYs,
    mismatchBases,
    mismatchFrequencies,
    mismatchQuals,
  } = resolved.rpcData

  // Topmost, not first: see `findTopmostOnRow`. Two reads overlapping on one
  // collapsed row rarely agree about the base at a position — that disagreement
  // is what a pileup is for — so answering with the covered one named the wrong
  // allele beside the right read.
  const i = findTopmostOnRow(
    mismatchYs,
    0,
    mismatchPositions.length,
    row,
    i =>
      mismatchPositions[i] === basePos &&
      passesFrequencyGate(
        bpPerPx,
        mismatchFrequencies[i] ?? 0,
        filterMismatchesByFrequency,
      ),
  )
  return i === undefined
    ? undefined
    : {
        type: 'mismatch',
        index: i,
        position: mismatchPositions[i]!,
        length: 1,
        base: String.fromCharCode(mismatchBases[i]!),
        qual: mismatchQuals[i],
      }
}

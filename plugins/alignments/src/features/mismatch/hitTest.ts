import { passesFrequencyGate } from '../../LinearAlignmentsDisplay/constants.ts'
import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
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
  if (i === undefined) {
    return undefined
  }
  // The array's sentinel resolves to "absent" here, at the boundary where the
  // byte stops being a shader input and becomes something a person reads. Past
  // this point `qual` is a Phred score or nothing, so a hover can report Q0 —
  // a real, and notably bad, score — without the readers having to know that 255
  // is not one.
  const qual = mismatchQuals[i]!
  return {
    type: 'mismatch',
    index: i,
    position: mismatchPositions[i]!,
    length: 1,
    base: String.fromCharCode(mismatchBases[i]!),
    qual: qual === QUAL_UNAVAILABLE ? undefined : qual,
  }
}

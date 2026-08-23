import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
import { findMarkAt } from '../mark.ts'
import { MISMATCH_MARK } from './mark.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

// The cell, the row scan and the significance gate are the mark's; this reads
// the answer out as the base a person sees. Two reads overlapping on one
// collapsed row rarely agree about the base at a position — that disagreement is
// what a pileup is for — so `findMarkAt` answering with the topmost rather than
// the first is what keeps the allele beside the read `hitTestFeature` names.
export function hitTestMismatch(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const data = resolved.rpcData
  const i = findMarkAt(MISMATCH_MARK, data, coords, filterMismatchesByFrequency)
  // The array's sentinel resolves to "absent" here, at the boundary where the
  // byte stops being a shader input and becomes something a person reads. Past
  // this point `qual` is a Phred score or nothing, so a hover can report Q0 —
  // a real, and notably bad, score — without the readers having to know that 255
  // is not one.
  const qual = i === undefined ? undefined : data.mismatchQuals[i]!
  return i === undefined
    ? undefined
    : {
        type: 'mismatch',
        index: i,
        position: MISMATCH_MARK.startBp(data, i),
        length: 1,
        base: String.fromCharCode(data.mismatchBases[i]!),
        qual: qual === QUAL_UNAVAILABLE ? undefined : qual,
      }
}

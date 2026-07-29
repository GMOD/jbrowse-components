import { passesFrequencyGate } from '../../LinearAlignmentsDisplay/constants.ts'

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
  const numMismatches = mismatchPositions.length

  for (let i = 0; i < numMismatches; i++) {
    if (mismatchYs[i] !== row) {
      continue
    }
    const pos = mismatchPositions[i]
    if (
      pos !== undefined &&
      basePos === pos &&
      passesFrequencyGate(
        bpPerPx,
        mismatchFrequencies[i] ?? 0,
        filterMismatchesByFrequency,
      )
    ) {
      const baseCode = mismatchBases[i]!
      return {
        type: 'mismatch',
        index: i,
        position: pos,
        length: 1,
        base: String.fromCharCode(baseCode),
        qual: mismatchQuals[i],
      }
    }
  }
  return undefined
}

import { getNextRefPos } from '@jbrowse/cigar-utils'

import { modProbAt } from './getModProbabilities.ts'

import type { ModWithPositions } from './getModPositions.ts'
import type { CigarCursor } from '@jbrowse/cigar-utils'

// Walk every modification's read-sequence positions, mapping each to its
// reference position via the CIGAR and recovering its ML probability. The
// ML-array offset (probStart/probStride) is precomputed per modification by
// getModPositions, so this no longer tracks a running index by hand. `from`
// starts every walk at a `refWindowToRead` cursor, for positions cut to it.
export function forEachModRefPos(
  modifications: readonly ModWithPositions[],
  probabilities: number[] | undefined,
  cigarOps: ArrayLike<number>,
  isReverse: boolean,
  cb: (mod: ModWithPositions, ref: number, idx: number, prob: number) => void,
  from?: CigarCursor,
) {
  for (const mod of modifications) {
    const { positions, probStart, probStride } = mod
    getNextRefPos(
      cigarOps,
      positions,
      (ref, idx) => {
        const prob = modProbAt(
          probabilities,
          probStart,
          probStride,
          isReverse,
          idx,
          positions.length,
        )
        cb(mod, ref, idx, prob)
      },
      from,
    )
  }
}

import { getNextRefPos } from '@jbrowse/cigar-utils'

import { modProbAt } from './getModProbabilities.ts'

import type { ModWithPositions } from './getModPositions.ts'

// Walk every modification's read-sequence positions, mapping each to its
// reference position via the CIGAR and recovering its ML/MP probability. Owns
// the running probIndex into the flat probabilities array so callers don't have
// to track the per-modification offset themselves (an easy source of bugs).
export function forEachModRefPos(
  modifications: readonly ModWithPositions[],
  probabilities: number[] | undefined,
  cigarOps: ArrayLike<number>,
  isReverse: boolean,
  cb: (mod: ModWithPositions, ref: number, idx: number, prob: number) => void,
) {
  let probIndex = 0
  for (const mod of modifications) {
    const { positions } = mod
    getNextRefPos(cigarOps, positions, (ref, idx) => {
      const prob = modProbAt(
        probabilities,
        probIndex,
        isReverse,
        idx,
        positions.length,
      )
      cb(mod, ref, idx, prob)
    })
    probIndex += positions.length
  }
}

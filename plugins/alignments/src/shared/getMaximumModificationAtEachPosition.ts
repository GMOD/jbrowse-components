import { getNextRefPos } from '@jbrowse/cigar-utils'
import { modProbAt } from '@jbrowse/modifications-utils'

import type { getModPositions } from '@jbrowse/modifications-utils'

export function getMaxProbModAtEachPosition(
  modifications: ReturnType<typeof getModPositions>,
  probabilities: number[] | undefined,
  ops: ArrayLike<number>,
  fstrand: -1 | 0 | 1,
) {
  const maxProbModForPosition: {
    type: string
    base: string
    prob: number
  }[] = []
  let probIndex = 0
  for (const { type, base, positions } of modifications) {
    getNextRefPos(ops, positions, (ref, idx) => {
      const prob = modProbAt(
        probabilities,
        probIndex,
        fstrand === -1,
        idx,
        positions.length,
      )
      const existing = maxProbModForPosition[ref]
      if (!existing || prob > existing.prob) {
        maxProbModForPosition[ref] = { type, base, prob }
      }
    })
    probIndex += positions.length
  }
  return maxProbModForPosition
}

import { getNextRefPos } from '@jbrowse/cigar-utils'
import { getModProbabilities, modProbAt } from '@jbrowse/modifications-utils'

import { getTagAlt } from '../util.ts'

import type { Feature } from '@jbrowse/core/util'
import type { getModPositions } from '@jbrowse/modifications-utils'

interface MaximumProbabilityMod {
  type: string
  prob: number
  allProbs: number[]
}

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

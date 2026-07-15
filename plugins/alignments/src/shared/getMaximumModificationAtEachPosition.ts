import { forEachModRefPos } from '@jbrowse/modifications-utils'

import type { ModWithPositions } from '@jbrowse/modifications-utils'

export function getMaxProbModAtEachPosition(
  modifications: ModWithPositions[],
  probabilities: number[] | undefined,
  ops: ArrayLike<number>,
  fstrand: -1 | 0 | 1,
) {
  const maxProbModForPosition: {
    type: string
    base: string
    prob: number
  }[] = []
  forEachModRefPos(
    modifications,
    probabilities,
    ops,
    fstrand === -1,
    ({ type, base }, ref, _idx, prob) => {
      const existing = maxProbModForPosition[ref]
      if (!existing || prob > existing.prob) {
        maxProbModForPosition[ref] = { type, base, prob }
      }
    },
  )
  return maxProbModForPosition
}

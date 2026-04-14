import { getNextRefPos } from '../MismatchParser/index.ts'

import type { getModPositions } from '../ModificationParser/getModPositions.ts'

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
      const prob =
        probabilities?.[
          probIndex + (fstrand === -1 ? positions.length - 1 - idx : idx)
        ] ?? 0
      const existing = maxProbModForPosition[ref]
      if (!existing || prob > existing.prob) {
        maxProbModForPosition[ref] = { type, base, prob }
      }
    })
    probIndex += positions.length
  }
  return maxProbModForPosition
}

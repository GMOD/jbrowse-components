import { getNextRefPos, parseCigar } from '../MismatchParser'
import { getModPositions } from '../ModificationParser/getModPositions'
import { getModProbabilities } from '../ModificationParser/getModProbabilities'
import { getTagAlt } from '../util'

import type { Feature } from '@jbrowse/core/util'

interface MaximumProbabilityMod {
  type: string
  prob: number
  allProbs: number[]
}

export function getMaxProbModAtEachPosition(
  feature: Feature,
  cigarOps?: string[],
): Map<number, MaximumProbabilityMod> | undefined {
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const seq = feature.get('seq') as string | undefined
  const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
  const ops = cigarOps || parseCigar(feature.get('CIGAR'))
  if (seq) {
    const modifications = getModPositions(mm, seq, fstrand)
    const probabilities = getModProbabilities(feature)

    const maxProbModForPosition = new Map<number, MaximumProbabilityMod>()

    let probIndex = 0
    const modLen = modifications.length
    for (let i = 0; i < modLen; i++) {
      const mod = modifications[i]!
      const nextRefPosArray = getNextRefPos(ops, mod.positions)
      const nextRefPosLen = nextRefPosArray.length
      const posLen = mod.positions.length

      for (let j = 0; j < nextRefPosLen; j++) {
        const item = nextRefPosArray[j]!
        const prob =
          probabilities?.[
            probIndex + (fstrand === -1 ? posLen - 1 - item.idx : item.idx)
          ] || 0

        const existing = maxProbModForPosition.get(item.ref)
        if (!existing) {
          maxProbModForPosition.set(item.ref, {
            type: mod.type,
            prob,
            allProbs: [prob],
          })
        } else {
          // Mutate array in place instead of spreading
          existing.allProbs.push(prob)
          if (prob > existing.prob) {
            existing.prob = prob
            existing.type = mod.type
          }
        }
      }
      probIndex += posLen
    }

    return maxProbModForPosition
  }
  return undefined
}

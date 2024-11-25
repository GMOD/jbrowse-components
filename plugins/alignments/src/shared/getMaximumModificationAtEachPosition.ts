// locals
import { getNextRefPos, parseCigar } from '../MismatchParser'
import { getModPositions, getModProbabilities } from '../ModificationParser'
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
) {
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const seq = feature.get('seq') as string | undefined
  const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
  const ops = cigarOps || parseCigar(feature.get('CIGAR'))
  if (seq) {
    const modifications = getModPositions(mm, seq, fstrand)
    const probabilities = getModProbabilities(feature)
    const maxProbModForPosition = [] as MaximumProbabilityMod[]

    let probIndex = 0
    for (const { type, positions } of modifications) {
      for (const { ref, idx } of getNextRefPos(ops, positions)) {
        const prob =
          probabilities?.[
            probIndex + (fstrand === -1 ? positions.length - 1 - idx : idx)
          ] || 0
        if (!maxProbModForPosition[ref]) {
          maxProbModForPosition[ref] = {
            type,
            prob,
            allProbs: [prob],
          }
        } else {
          const old = maxProbModForPosition[ref]
          maxProbModForPosition[ref] = {
            allProbs: [...old.allProbs, prob],
            prob: Math.max(old.prob, prob),
            type: old.prob > prob ? old.type : type,
          }
        }
      }
      probIndex += positions.length
    }
    return maxProbModForPosition
  }
  return undefined
}

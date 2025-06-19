import { getNextRefPos } from '../MismatchParser'
import { getModPositions } from './getModPositions'
import { getModProbabilities } from './getModProbabilities'
import { getTagAlt } from '../util'

import type { Feature } from '@jbrowse/core/util'

export function getMethBins(feature: Feature, cigarOps: string[]) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const flen = fend - fstart
  const mm = (getTagAlt(feature, 'MM', 'Mm') as string | undefined) || ''
  const methBins = []
  const hydroxyMethBins = []
  const methProbs = []
  const hydroxyMethProbs = []
  const seq = feature.get('seq') as string | undefined
  if (seq) {
    const probabilities = getModProbabilities(feature)
    const modifications = getModPositions(mm, seq, fstrand)
    let probIndex = 0

    for (const { type, positions } of modifications) {
      for (const { ref, idx } of getNextRefPos(cigarOps, positions)) {
        // Skip positions outside the feature bounds
        if (ref < 0 || ref >= flen) {
          continue
        }

        // Calculate probability index based on strand
        const isReverseStrand = fstrand === -1
        const idx2 =
          probIndex + (isReverseStrand ? positions.length - 1 - idx : idx)
        const prob = probabilities?.[idx2] || 0

        // Store modification data in appropriate bins
        if (type === 'm') {
          methBins[ref] = 1
          methProbs[ref] = prob
        } else if (type === 'h') {
          hydroxyMethBins[ref] = 1
          hydroxyMethProbs[ref] = prob
        }
      }
      probIndex += positions.length
    }
  }
  return {
    methBins,
    hydroxyMethBins,
    methProbs,
    hydroxyMethProbs,
  }
}

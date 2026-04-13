import { getModPositions } from './getModPositions.ts'
import { getModProbabilities } from './getModProbabilities.ts'
import { getNextRefPos } from '../MismatchParser/index.ts'
import { getTagAlt } from '../util.ts'

import type { Feature } from '@jbrowse/core/util'

export function getMethBins(feature: Feature, cigarOps: ArrayLike<number>) {
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
    const isReverse = fstrand === -1
    const probabilities = getModProbabilities(feature)
    const modifications = getModPositions(mm, seq, fstrand)
    let probIndex = 0

    for (const { type, positions } of modifications) {
      if (type !== 'm' && type !== 'h') {
        probIndex += positions.length
        continue
      }
      for (const { ref, idx } of getNextRefPos(cigarOps, positions)) {
        if (ref < 0 || ref >= flen) {
          continue
        }

        // Check CpG context directly from the read sequence without allocating
        // a revcomp string. getModPositions stores positions as seqLength-currPos
        // for reverse strand (revcomp space), so:
        //   forward: pos is the C index in seq → seq[pos+1] must be G
        //   reverse: revcom(seq)[seqLength-pos] = complement(seq[pos-1])
        //            that equals 'G' iff seq[pos-1] === 'C'
        const pos = positions[idx]!
        if (isReverse) {
          const nb = seq[pos - 1]
          if (nb !== 'C' && nb !== 'c') continue
        } else {
          const nb = seq[pos + 1]
          if (nb !== 'G' && nb !== 'g') continue
        }

        const idx2 =
          probIndex + (isReverse ? positions.length - 1 - idx : idx)
        const prob = probabilities?.[idx2] || 0

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

import { revcom } from '@jbrowse/core/util'

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
    // For reverse-strand reads getModPositions works in revcomp space, so we
    // use the same processed sequence here for the CpG context check.
    const processedSeq = fstrand === -1 ? revcom(seq) : seq
    const seqLength = seq.length
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

        // Check CpG context from the read sequence (or its revcomp for reverse
        // strand). For forward strand: pos is the C index in seq, next base is
        // seq[pos+1]. For reverse strand: pos = seqLength-currPos so the C is
        // at revcomp index seqLength-pos-1, and the next revcomp base is at
        // seqLength-pos.
        const pos = positions[idx]!
        const nextIdx = fstrand === -1 ? seqLength - pos : pos + 1
        if (processedSeq[nextIdx]?.toLowerCase() !== 'g') {
          continue
        }

        const isReverseStrand = fstrand === -1
        const idx2 =
          probIndex + (isReverseStrand ? positions.length - 1 - idx : idx)
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

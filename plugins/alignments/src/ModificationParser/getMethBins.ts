import { getNextRefPos } from '../MismatchParser/index.ts'

import type { getModPositions } from './getModPositions.ts'

export interface ParsedModData {
  modifications: ReturnType<typeof getModPositions>
  probabilities: number[] | undefined
  cigarOps: ArrayLike<number>
  seq: string
  fstrand: -1 | 0 | 1
  flen: number
}

export function getMethBins({
  modifications,
  probabilities,
  cigarOps,
  seq,
  fstrand,
  flen,
}: ParsedModData) {
  const isReverse = fstrand === -1
  const methBins = [] as number[]
  const hydroxyMethBins = [] as number[]
  const methProbs = [] as number[]
  const hydroxyMethProbs = [] as number[]
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
      const nb = isReverse ? seq[pos - 1] : seq[pos + 1]
      const wanted = isReverse ? 'c' : 'g'
      if (nb?.toLowerCase() !== wanted) {
        continue
      }

      const idx2 = probIndex + (isReverse ? positions.length - 1 - idx : idx)
      const prob = probabilities?.[idx2] || 0

      if (type === 'm') {
        methBins[ref] = 1
        methProbs[ref] = prob
      } else {
        hydroxyMethBins[ref] = 1
        hydroxyMethProbs[ref] = prob
      }
    }
    probIndex += positions.length
  }

  return { methBins, hydroxyMethBins, methProbs, hydroxyMethProbs }
}

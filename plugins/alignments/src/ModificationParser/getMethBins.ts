import { getNextRefPos } from '../MismatchParser/index.ts'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '../shared/cigarUtil.ts'

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

  const mmCpgCount = methBins.filter(Boolean).length

  // Scan the full read sequence for ALL CpG dinucleotides and mark any not
  // already detected from the MM tag as unmethylated (prob=0).
  // Forward strand: C at readPos followed by G at readPos+1.
  // Reverse strand: the CIGAR scan runs in revcomp coordinate space (same
  // space that getModPositions uses), so a CpG in revcomp appears as
  // seq[readPos]='G' preceded by seq[readPos-1]='C' in the stored read.
  let readPos = 0
  let refPos = 0
  for (let i = 0, l = cigarOps.length; i < l; i++) {
    const packed = cigarOps[i]!
    const len = packed >> 4
    const op = packed & 0xf
    if (op === CIGAR_S || op === CIGAR_I) {
      readPos += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      refPos += len
    } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
      for (let j = 0; j < len; j++) {
        const rp = readPos + j
        const rf = refPos + j
        const isCpG = isReverse
          ? seq[rp]?.toLowerCase() === 'g' && seq[rp - 1]?.toLowerCase() === 'c'
          : seq[rp]?.toLowerCase() === 'c' && seq[rp + 1]?.toLowerCase() === 'g'
        if (isCpG && rf >= 0 && rf < flen && !methBins[rf]) {
          methBins[rf] = 1
          methProbs[rf] = 0
        }
      }
      readPos += len
      refPos += len
    }
  }

  return { methBins, hydroxyMethBins, methProbs, hydroxyMethProbs }
}

import { modProbAt } from './getModProbabilities.ts'
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

// Check CpG dinucleotide context at a read sequence position.
// getModPositions stores reverse-strand positions in revcomp space, where
// a CpG appears as seq[pos]='G' preceded by seq[pos-1]='C'.
function isCpGAt(seq: string, pos: number, isReverse: boolean) {
  return isReverse
    ? seq[pos]?.toLowerCase() === 'g' && seq[pos - 1]?.toLowerCase() === 'c'
    : seq[pos]?.toLowerCase() === 'c' && seq[pos + 1]?.toLowerCase() === 'g'
}

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
  const methBins: number[] = []
  const hydroxyMethBins: number[] = []
  const methProbs: number[] = []
  const hydroxyMethProbs: number[] = []
  let probIndex = 0

  for (const { type, positions } of modifications) {
    if (type !== 'm' && type !== 'h') {
      probIndex += positions.length
      continue
    }
    getNextRefPos(cigarOps, positions, (ref, idx) => {
      if (ref < 0 || ref >= flen || !isCpGAt(seq, positions[idx]!, isReverse)) {
        return
      }
      const prob = modProbAt(
        probabilities,
        probIndex,
        isReverse,
        idx,
        positions.length,
      )
      if (type === 'm') {
        methBins[ref] = 1
        methProbs[ref] = prob
      } else {
        hydroxyMethBins[ref] = 1
        hydroxyMethProbs[ref] = prob
      }
    })
    probIndex += positions.length
  }

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
        if (
          isCpGAt(seq, rp, isReverse) &&
          rf >= 0 &&
          rf < flen &&
          !methBins[rf]
        ) {
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

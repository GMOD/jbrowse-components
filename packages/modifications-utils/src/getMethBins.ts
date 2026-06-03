import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import { forEachModRefPos } from './forEachModRefPos.ts'

import type { ModWithPositions } from './getModPositions.ts'

// Check CpG dinucleotide context at a read sequence position.
// getModPositions stores reverse-strand positions in revcomp space, where
// a CpG appears as seq[pos]='G' preceded by seq[pos-1]='C'.
function isCpGAt(seq: string, pos: number, isReverse: boolean) {
  return isReverse
    ? seq[pos]?.toLowerCase() === 'g' && seq[pos - 1]?.toLowerCase() === 'c'
    : seq[pos]?.toLowerCase() === 'c' && seq[pos + 1]?.toLowerCase() === 'g'
}

export interface ParsedModData {
  modifications: ModWithPositions[]
  probabilities: number[] | undefined
  cigarOps: ArrayLike<number>
  seq: string
  fstrand: -1 | 0 | 1
  flen: number
}

/**
 * #api
 * Bins per-read base modifications and their probabilities onto reference
 * positions, returning typed arrays for methylated/unmethylated calls.
 */
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

  forEachModRefPos(
    modifications,
    probabilities,
    cigarOps,
    isReverse,
    ({ type, positions }, ref, idx, prob) => {
      const isMeth = type === 'm' || type === 'h'
      if (
        isMeth &&
        ref >= 0 &&
        ref < flen &&
        isCpGAt(seq, positions[idx]!, isReverse)
      ) {
        if (type === 'm') {
          methBins[ref] = 1
          methProbs[ref] = prob
        } else {
          hydroxyMethBins[ref] = 1
          hydroxyMethProbs[ref] = prob
        }
      }
    },
  )

  // Only fill undetected CpGs as unmethylated when the read actually carries a
  // 5mC ('m') call. A read with only e.g. 6mA modifications never assayed
  // methylation, so inventing unmethylated CpGs for it would be wrong.
  // Additionally, per SAMtags the '?' flag means the status of bases not listed
  // in the MM tag is unknown, so we must NOT assume them unmethylated; only the
  // '.'/absent flag (low probability for skipped bases) lets us fill them in.
  const hasMeth = modifications.some(m => m.type === 'm')
  const fillUnmethylated =
    hasMeth && !modifications.some(m => m.type === 'm' && m.unknownSkip)

  // Scan the full read sequence for ALL CpG dinucleotides and mark any not
  // already detected from the MM tag as unmethylated (prob=0).
  // Forward strand: C at readPos followed by G at readPos+1.
  // Reverse strand: the CIGAR scan runs in revcomp coordinate space (same
  // space that getModPositions uses), so a CpG in revcomp appears as
  // seq[readPos]='G' preceded by seq[readPos-1]='C' in the stored read.
  if (fillUnmethylated) {
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
  }

  return { methBins, hydroxyMethBins, methProbs, hydroxyMethProbs }
}

import { createEmptyBin } from './processDepth'
import { inc, incSNP, isInterbase, mismatchLen } from './util'
import {
  CAT_DELSKIP,
  CAT_NONCOV,
  MISMATCH_TYPE_DELETION,
  MISMATCH_TYPE_DELSKIP_MASK,
  MISMATCH_TYPE_HARDCLIP,
  MISMATCH_TYPE_INSERTION,
  MISMATCH_TYPE_SKIP,
  MISMATCH_TYPE_SOFTCLIP,
} from '../shared/types'

import type { FlatBaseCoverageBin, Mismatch, SkipMap } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

const MISMATCH_TYPE_NAMES: Record<number, string> = {
  [MISMATCH_TYPE_INSERTION]: 'insertion',
  [MISMATCH_TYPE_DELETION]: 'deletion',
  [MISMATCH_TYPE_SKIP]: 'skip',
  [MISMATCH_TYPE_SOFTCLIP]: 'softclip',
  [MISMATCH_TYPE_HARDCLIP]: 'hardclip',
}

// Strand to flat ref key
const STRAND_TO_REF: Record<-1 | 1, 'refNeg' | 'refPos'> = {
  [-1]: 'refNeg',
  [1]: 'refPos',
}

export function processMismatches({
  feature,
  region,
  bins,
  skipmap,
}: {
  region: AugmentedRegion
  bins: FlatBaseCoverageBin[]
  feature: Feature
  skipmap: SkipMap
}) {
  const fstart = feature.get('start')
  const fstrand = feature.get('strand') as -1 | 1
  const strandRef = STRAND_TO_REF[fstrand]
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []

  for (const mismatch of mismatches) {
    const mstart = fstart + mismatch.start
    const mlen = mismatchLen(mismatch)
    const mend = mstart + mlen
    for (let j = mstart; j < mstart + mlen; j++) {
      const epos = j - region.start
      if (epos >= 0 && epos < bins.length) {
        let bin = bins[epos]
        if (!bin) {
          bin = bins[epos] = createEmptyBin()
        }
        const { base, altbase, type } = mismatch
        const interbase = isInterbase(type)

        if ((type & MISMATCH_TYPE_DELSKIP_MASK) !== 0) {
          inc(bin, fstrand, CAT_DELSKIP + MISMATCH_TYPE_NAMES[type]!)
          bin.depth--
        } else if (!interbase) {
          incSNP(bin, fstrand, base as 'A' | 'G' | 'C' | 'T')
          bin.refDepth--
          bin[strandRef]--
          bin.refbase = altbase
        } else {
          inc(bin, fstrand, CAT_NONCOV + MISMATCH_TYPE_NAMES[type]!)
        }
      }
    }

    if (mismatch.type === MISMATCH_TYPE_SKIP) {
      // for upper case XS and TS: reports the literal strand of the genomic
      // transcript
      const tags = feature.get('tags')
      const xs = tags?.XS || tags?.TS
      // for lower case ts from minimap2: genomic transcript flipped by read
      // strand
      const ts = tags?.ts
      const effectiveStrand =
        xs === '+'
          ? 1
          : xs === '-'
            ? -1
            : (ts === '+' ? 1 : xs === '-' ? -1 : 0) * fstrand
      const hash = `${mstart}_${mend}_${effectiveStrand}`
      if (skipmap[hash] === undefined) {
        skipmap[hash] = {
          feature: feature,
          start: mstart,
          end: mend,
          strand: fstrand,
          effectiveStrand,
          score: 0,
        }
      }
      skipmap[hash].score++
    }
  }
}

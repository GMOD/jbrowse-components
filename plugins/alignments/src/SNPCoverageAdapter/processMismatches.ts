import { createEmptyBin } from './processDepth'
import { inc, isInterbase, mismatchLen } from './util'
import {
  CAT_DELSKIP,
  CAT_NONCOV,
  ENTRY_DEPTH,
  ENTRY_NEG,
  ENTRY_POS,
} from '../shared/types'

import type { FlatBaseCoverageBin, Mismatch, SkipMap } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

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

        if (type === 'deletion' || type === 'skip') {
          inc(bin, fstrand, CAT_DELSKIP + type)
          bin.depth--
        } else if (!interbase) {
          const snpBase = base as 'A' | 'G' | 'C' | 'T'
          let entry = bin[snpBase]
          if (!entry) {
            entry = new Uint32Array(3)
            bin[snpBase] = entry
          }
          entry[ENTRY_DEPTH] = (entry[ENTRY_DEPTH] || 0) + 1
          entry[fstrand === 1 ? ENTRY_POS : ENTRY_NEG] =
            (entry[fstrand === 1 ? ENTRY_POS : ENTRY_NEG] || 0) + 1
          bin.refDepth--
          bin[strandRef]--
          bin.refbase = altbase
        } else {
          const len =
            type === 'insertion'
              ? mismatch.insertedBases?.length
              : mismatch.cliplen
          inc(bin, fstrand, CAT_NONCOV + type, len)
        }
      }
    }

    if (mismatch.type === 'skip') {
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

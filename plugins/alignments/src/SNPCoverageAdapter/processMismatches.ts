import { inc, isInterbase, mismatchLen } from './util'
import {
  MISMATCH_TYPE,
  INSERTION_TYPE,
  DELETION_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
  HARDCLIP_TYPE,
} from '../shared/forEachMismatchTypes'

import type { Mismatch, PreBaseCoverageBin, SkipMap } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'
import type { MismatchCallback } from '../shared/forEachMismatchTypes'

interface FeatureWithMismatchIterator extends Feature {
  forEachMismatch(callback: MismatchCallback): void
}

export function processMismatches({
  feature,
  region,
  bins,
  skipmap,
}: {
  region: AugmentedRegion
  bins: PreBaseCoverageBin[]
  feature: FeatureWithMismatchIterator
  skipmap: SkipMap
}) {
  const fstart = feature.get('start')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const regionStart = region.start
  const regionEnd = region.end
  const binsLength = bins.length

  // normal SNP based coloring
  feature.forEachMismatch(
    (type, start, length, base, _qual, altbase, cliplen) => {
      const mstart = fstart + start
      const mlen = length
      const mend = mstart + mlen

      // Calculate visible range for this mismatch
      const visStart = Math.max(mstart, regionStart)
      const visEnd = Math.min(mend, regionEnd)

      // Skip if mismatch is entirely outside visible region
      if (visStart < visEnd) {
        for (let j = visStart; j < visEnd; j++) {
          const epos = j - regionStart
          if (epos < binsLength) {
            const bin = bins[epos]!
            const interbase = isInterbase(type)

            if (type === DELETION_TYPE || type === SKIP_TYPE) {
              inc(bin, fstrand, 'delskips', type)
              bin.depth--
            } else if (!interbase) {
              inc(bin, fstrand, 'snps', base)
              bin.ref.entryDepth--
              bin.ref[fstrand]--
              bin.refbase = altbase
            } else {
              const len = type === INSERTION_TYPE ? length : cliplen
              const seq = type === INSERTION_TYPE ? base : undefined
              inc(bin, fstrand, 'noncov', type, len, seq)
            }
          }
        }
      }

      if (type === SKIP_TYPE) {
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
    },
  )
}


import { inc, isInterbase, mismatchLen } from './util'

import type { Mismatch, PreBaseCoverageBin, SkipMap } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

export function processMismatches({
  feature,
  region,
  bins,
  skipmap,
}: {
  region: AugmentedRegion
  bins: PreBaseCoverageBin[]
  feature: Feature
  skipmap: SkipMap
}) {
  const fstart = feature.get('start')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []
  const regionStart = region.start
  const binsLength = bins.length
  const mismatchesLength = mismatches.length

  for (let mi = 0; mi < mismatchesLength; mi++) {
    const mismatch = mismatches[mi]!
    const mstart = fstart + mismatch.start
    const mlen = mismatchLen(mismatch)
    const mend = mstart + mlen
    const { base, altbase, type } = mismatch
    const interbase = isInterbase(type)

    for (let j = mstart; j < mend; j++) {
      const epos = j - regionStart
      if (epos >= 0 && epos < binsLength) {
        const bin = bins[epos]!

        if (type === 'deletion' || type === 'skip') {
          inc(bin, fstrand, 'delskips', type)
          bin.depth--
        } else if (!interbase) {
          inc(bin, fstrand, 'snps', base)
          const ref = bin.ref
          ref.entryDepth--
          ref[fstrand]--
          bin.refbase = altbase
        } else {
          inc(bin, fstrand, 'noncov', type)
        }
      }
    }

    if (type === 'skip') {
      const tags = feature.get('tags')
      const xs = tags?.XS || tags?.TS
      const ts = tags?.ts
      const effectiveStrand =
        xs === '+'
          ? 1
          : xs === '-'
            ? -1
            : (ts === '+' ? 1 : xs === '-' ? -1 : 0) * fstrand
      const hash = `${mstart}_${mend}_${effectiveStrand}`
      const existing = skipmap[hash]
      if (!existing) {
        skipmap[hash] = {
          feature,
          start: mstart,
          end: mend,
          strand: fstrand,
          effectiveStrand,
          score: 1,
        }
      } else {
        existing.score++
      }
    }
  }
}

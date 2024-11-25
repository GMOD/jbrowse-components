import { inc, isInterbase, mismatchLen } from './util'
import type { Mismatch, PreBaseCoverageBin, SkipMap } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

// locals

export function processMismatches({
  feature,
  region,
  bins,
  skipmap,
}: {
  region: Region
  bins: PreBaseCoverageBin[]
  feature: Feature
  skipmap: SkipMap
}) {
  const fstart = feature.get('start')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []

  // normal SNP based coloring
  for (const mismatch of mismatches) {
    const mstart = fstart + mismatch.start
    const mlen = mismatchLen(mismatch)
    const mend = mstart + mlen
    for (let j = mstart; j < mstart + mlen; j++) {
      const epos = j - region.start
      if (epos >= 0 && epos < bins.length) {
        const bin = bins[epos]!
        const { base, type } = mismatch
        const interbase = isInterbase(type)

        if (type === 'deletion' || type === 'skip') {
          inc(bin, fstrand, 'delskips', type)
          bin.depth--
        } else if (!interbase) {
          inc(bin, fstrand, 'snps', base)
          bin.ref.entryDepth--
          bin.ref[fstrand]--
        } else {
          inc(bin, fstrand, 'noncov', type)
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

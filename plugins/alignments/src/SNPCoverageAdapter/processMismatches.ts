import { inc, isInterbaseType, mismatchLenSOA } from './util'
import {
  CHAR_CODE_TO_STRING,
  TYPE_DELETION,
  TYPE_INSERTION,
  TYPE_SKIP,
  TYPE_SOFTCLIP,
  getMismatchesFromFeature,
} from '../shared/types'

import type { PreBaseCoverageBin, SkipMap } from '../shared/types'
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
  const mismatches = getMismatchesFromFeature(feature)
  const regionStart = region.start
  const regionEnd = region.end
  const binsLength = bins.length

  if (!mismatches || mismatches.count === 0) {
    return
  }

  const { count, starts, lengths, types, bases, altbases, insertedBases } =
    mismatches

  // normal SNP based coloring
  for (let i = 0; i < count; i++) {
    const type = types[i]!
    const mstart = fstart + starts[i]!
    const mlen = mismatchLenSOA(type, lengths[i]!)
    const mend = mstart + mlen

    // Calculate visible range for this mismatch
    const visStart = Math.max(mstart, regionStart)
    const visEnd = Math.min(mend, regionEnd)

    // Skip if mismatch is entirely outside visible region
    if (visStart < visEnd) {
      // Hoist invariants out of inner loop
      const interbase = isInterbaseType(type)
      const baseChar = CHAR_CODE_TO_STRING[bases[i]!]!
      const altbaseChar =
        altbases[i] !== 0 ? CHAR_CODE_TO_STRING[altbases[i]!] : undefined

      if (type === TYPE_DELETION || type === TYPE_SKIP) {
        const typeName = type === TYPE_DELETION ? 'deletion' : 'skip'
        for (let j = visStart; j < visEnd; j++) {
          const epos = j - regionStart
          if (epos < binsLength) {
            const bin = bins[epos]!
            inc(bin, fstrand, 'delskips', typeName)
            bin.depth--
          }
        }
      } else if (!interbase) {
        for (let j = visStart; j < visEnd; j++) {
          const epos = j - regionStart
          if (epos < binsLength) {
            const bin = bins[epos]!
            inc(bin, fstrand, 'snps', baseChar)
            bin.ref.entryDepth--
            bin.ref[fstrand]--
            bin.refbase = altbaseChar
          }
        }
      } else {
        const len = lengths[i]
        const seq = type === TYPE_INSERTION ? insertedBases.get(i) : undefined
        const typeName =
          type === TYPE_INSERTION
            ? 'insertion'
            : type === TYPE_SOFTCLIP
              ? 'softclip'
              : 'hardclip'
        for (let j = visStart; j < visEnd; j++) {
          const epos = j - regionStart
          if (epos < binsLength) {
            const bin = bins[epos]!
            inc(bin, fstrand, 'noncov', typeName, len, seq)
          }
        }
      }
    }

    if (type === TYPE_SKIP) {
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

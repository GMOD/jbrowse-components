import { inc, isInterbase, mismatchLen } from './util'

import type {
  Mismatch,
  PreBaseCoverageBin,
  PreBaseCoverageBinSubtypes,
  SkipMap,
} from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

// Optimized inc() - further reduce property lookups and object creation
function incInline(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
) {
  const typeObj = bin[type]
  let thisBin = typeObj[field]
  if (!thisBin) {
    // Create new entry with strand pre-set
    thisBin = typeObj[field] = {
      entryDepth: 1,
      '-1': strand === -1 ? 1 : 0,
      '0': strand === 0 ? 1 : 0,
      '1': strand === 1 ? 1 : 0,
    }
  } else {
    thisBin.entryDepth++
    thisBin[strand]++
  }
}

function initBin(): PreBaseCoverageBin {
  return {
    depth: 0,
    readsCounted: 0,
    ref: {
      entryDepth: 0,
      '-1': 0,
      0: 0,
      1: 0,
    },
    snps: {},
    mods: {},
    nonmods: {},
    delskips: {},
    noncov: {},
  }
}

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
  const tags = feature.get('tags')
  const xs = tags?.XS || tags?.TS
  const ts = tags?.ts

  for (let mi = 0; mi < mismatchesLength; mi++) {
    const mismatch = mismatches[mi]!
    const mstart = fstart + mismatch.start
    const mlen = mismatchLen(mismatch)
    const { base, altbase, type } = mismatch
    const interbase = isInterbase(type)
    const isDeletion = type === 'deletion'
    const isSkip = type === 'skip'

    // Compute bounds once
    const jend = mstart + mlen
    const startIdx = Math.max(0, mstart - regionStart)
    const endIdx = Math.min(binsLength, jend - regionStart)

    if (isDeletion || isSkip) {
      for (let idx = startIdx; idx < endIdx; idx++) {
        const bin = bins[idx]!
        incInline(bin, fstrand, 'delskips', type)
        bin.depth--
      }
    } else if (!interbase) {
      for (let idx = startIdx; idx < endIdx; idx++) {
        const bin = bins[idx]!
        incInline(bin, fstrand, 'snps', base)
        const ref = bin.ref
        ref.entryDepth--
        ref[fstrand]--
        bin.refbase = altbase
      }
    } else {
      for (let idx = startIdx; idx < endIdx; idx++) {
        const bin = bins[idx]!
        incInline(bin, fstrand, 'noncov', type)
      }
    }

    if (isSkip) {
      const effectiveStrand =
        xs === '+'
          ? 1
          : xs === '-'
            ? -1
            : (ts === '+' ? 1 : xs === '-' ? -1 : 0) * fstrand
      const hash = `${mstart}_${mstart + mlen}_${effectiveStrand}`
      const existing = skipmap[hash]
      if (!existing) {
        skipmap[hash] = {
          feature,
          start: mstart,
          end: mstart + mlen,
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

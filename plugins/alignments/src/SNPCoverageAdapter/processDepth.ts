import type { FlatBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

// Strand to flat index: -1 -> 1 (refNeg), 0 -> 2 (refZero), 1 -> 3 (refPos)
const STRAND_TO_IDX = { '-1': 'refNeg', '0': 'refZero', '1': 'refPos' } as const

export function createEmptyBin(): FlatBaseCoverageBin {
  return {
    depth: 0,
    readsCounted: 0,
    refDepth: 0,
    refNeg: 0,
    refZero: 0,
    refPos: 0,
    entries: new Map(),
  }
}

export function processDepth({
  feature,
  bins,
  region,
}: {
  feature: Feature
  bins: FlatBaseCoverageBin[]
  region: AugmentedRegion
}) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const strandKey = STRAND_TO_IDX[fstrand]
  const regionLength = region.end - region.start
  for (let j = fstart; j < fend + 1; j++) {
    const i = j - region.start
    if (i >= 0 && i < regionLength) {
      if (bins[i] === undefined) {
        bins[i] = createEmptyBin()
      }
      if (j !== fend) {
        const bin = bins[i]
        bin.depth++
        bin.readsCounted++
        bin.refDepth++
        bin[strandKey]++
      }
    }
  }
}

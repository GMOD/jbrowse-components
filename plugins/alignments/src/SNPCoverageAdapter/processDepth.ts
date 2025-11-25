import type { FlatBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

// Strand to flat index: -1 -> refNeg, 1 -> refPos
const STRAND_TO_IDX: Record<-1 | 1, 'refNeg' | 'refPos'> = {
  [-1]: 'refNeg',
  [1]: 'refPos',
}

export function createEmptyBin(): FlatBaseCoverageBin {
  return {
    depth: 0,
    readsCounted: 0,
    refDepth: 0,
    refNeg: 0,
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
  const fstrand = feature.get('strand') as -1 | 1
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

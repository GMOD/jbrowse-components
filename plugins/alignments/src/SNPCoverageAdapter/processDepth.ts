import { createPreBinEntry } from './util'

import type { PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

export function processDepth({
  feature,
  bins,
  region,
}: {
  feature: Feature
  bins: PreBaseCoverageBin[]
  region: AugmentedRegion
}) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const regionLength = region.end - region.start
  for (let j = fstart; j < fend + 1; j++) {
    const i = j - region.start
    if (i >= 0 && i < regionLength) {
      const bin = (bins[i] ??= {
        depth: 0,
        readsCounted: 0,
        ref: createPreBinEntry(),
        snps: {},
        mods: {},
        nonmods: {},
        delskips: {},
        noncov: {},
      })
      if (j !== fend) {
        bin.depth++
        bin.readsCounted++
        bin.ref.entryDepth++
        bin.ref[fstrand]++
      }
    }
  }
}

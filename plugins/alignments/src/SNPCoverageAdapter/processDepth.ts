import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import { Feature } from '@jbrowse/core/util'

// locals
import { PreBaseCoverageBin } from '../shared/types'

export function processDepth({
  feature,
  bins,
  region,
  regionSequence,
}: {
  feature: Feature
  bins: PreBaseCoverageBin[]
  region: Region
  regionSequence: string
}) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const regionLength = region.end - region.start
  for (let j = fstart; j < fend + 1; j++) {
    const i = j - region.start
    if (i >= 0 && i < regionLength) {
      if (bins[i] === undefined) {
        bins[i] = {
          depth: 0,
          readsCounted: 0,
          refbase: regionSequence[i],
          ref: {
            probabilities: [],
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
      if (j !== fend) {
        bins[i].depth++
        bins[i].readsCounted++
        bins[i].ref.entryDepth++
        bins[i].ref[fstrand]++
      }
    }
  }
}

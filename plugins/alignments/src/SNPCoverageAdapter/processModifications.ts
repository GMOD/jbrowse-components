import { max, sum } from '@jbrowse/core/util'

// locals
import { incWithProbabilities } from './util'
import { getMaxProbModAtEachPosition } from '../shared/getMaximumModificationAtEachPosition'
import type { ColorBy, PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export function processModifications({
  feature,
  colorBy,
  region,
  bins,
  regionSequence,
}: {
  bins: PreBaseCoverageBin[]
  feature: Feature
  region: Region
  colorBy?: ColorBy
  regionSequence: string
}) {
  const fstart = feature.get('start')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const fend = feature.get('end')
  const twoColor = colorBy?.modifications?.twoColor
  const isolatedModification = colorBy?.modifications?.isolatedModification
  getMaxProbModAtEachPosition(feature)?.forEach(
    ({ type, prob, allProbs }, pos) => {
      if (isolatedModification && type !== isolatedModification) {
        return
      }
      const epos = pos + fstart - region.start
      if (epos >= 0 && epos < bins.length && pos + fstart < fend) {
        if (bins[epos] === undefined) {
          bins[epos] = {
            depth: 0,
            readsCounted: 0,
            refbase: regionSequence[epos],
            snps: {},
            ref: {
              probabilities: [],
              entryDepth: 0,
              '-1': 0,
              0: 0,
              1: 0,
            },
            mods: {},
            nonmods: {},
            delskips: {},
            noncov: {},
          }
        }

        const s = 1 - sum(allProbs)
        const bin = bins[epos]
        if (twoColor && s > max(allProbs)) {
          incWithProbabilities(bin, fstrand, 'nonmods', `nonmod_${type}`, s)
        } else {
          incWithProbabilities(bin, fstrand, 'mods', `mod_${type}`, prob)
        }
      }
    },
  )
}

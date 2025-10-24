import { max, sum } from '@jbrowse/core/util'

import { incWithProbabilities } from './util'
import { getMaxProbModAtEachPosition } from '../shared/getMaximumModificationAtEachPosition'
import { parseCigar } from '../MismatchParser'

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
  const seq = feature.get('seq') as string | undefined

  if (!seq) {
    return
  }

  const cigarOps = parseCigar(feature.get('CIGAR'))

  // Get only the maximum probability modification at each position
  // this is a hole-y array, does not work with normal for loop
  // eslint-disable-next-line unicorn/no-array-for-each
  getMaxProbModAtEachPosition(feature, cigarOps)?.forEach(
    ({ allProbs, prob, type }, pos) => {
      if (isolatedModification && type !== isolatedModification) {
        return
      }

      const epos = pos + fstart - region.start
      if (epos >= 0 && epos < bins.length && pos + fstart < fend) {
        if (bins[epos] === undefined) {
          bins[epos] = {
            depth: 0,
            readsCounted: 0,
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

        const bin = bins[epos]
        bin.refbase = regionSequence[epos]

        const s = 1 - sum(allProbs)
        if (twoColor && s > max(allProbs)) {
          incWithProbabilities(bin, fstrand, 'nonmods', `nonmod_${type}`, s)
        } else {
          incWithProbabilities(bin, fstrand, 'mods', `mod_${type}`, prob)
        }
      }
    },
  )
}

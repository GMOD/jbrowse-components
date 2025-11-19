import { max, sum } from '@jbrowse/core/util'

import { incWithProbabilities } from './util'
import { parseCigar } from '../MismatchParser'
import { getMaxProbModAtEachPosition } from '../shared/getMaximumModificationAtEachPosition'

import type { ColorBy, PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export function processModifications(
  feature: Feature,
  colorBy: ColorBy | undefined,
  bins: PreBaseCoverageBin[],
  region: Region,
  regionSequence: string,
) {
  const fstart = feature.get('start')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const fend = feature.get('end')
  const twoColor = colorBy?.modifications?.twoColor
  const isolatedModification = colorBy?.modifications?.isolatedModification
  const seq = feature.get('seq') as string | undefined
  const modificationThreshold = colorBy?.modifications?.threshold ?? 10
  const thresholdFraction = modificationThreshold / 100

  if (!seq) {
    return
  }

  const cigarOps = parseCigar(feature.get('CIGAR'))
  const regionStart = region.start
  const binsLength = bins.length

  // Get only the maximum probability modification at each position
  // this is a hole-y array, does not work with normal for loop
  // eslint-disable-next-line unicorn/no-array-for-each
  getMaxProbModAtEachPosition(feature, cigarOps)?.forEach(
    ({ allProbs, prob, type }, pos) => {
      if (isolatedModification && type !== isolatedModification) {
        return
      }

      // Check if modification probability exceeds threshold
      if (prob < thresholdFraction) {
        return
      }

      const epos = pos + fstart - regionStart
      if (epos >= 0 && epos < binsLength && pos + fstart < fend) {
        let bin = bins[epos]
        if (!bin) {
          bin = bins[epos] = {
            depth: 0,
            readsCounted: 0,
            snps: {},
            ref: {
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

        bin.refbase = regionSequence[epos]

        const s = 1 - sum(allProbs)
        const modType = `mod_${type}`
        if (twoColor && s > max(allProbs)) {
          incWithProbabilities(bin, fstrand, 'nonmods', `nonmod_${type}`, s)
        } else {
          incWithProbabilities(bin, fstrand, 'mods', modType, prob)
        }
      }
    },
  )
}

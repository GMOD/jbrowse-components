import { max, sum } from '@jbrowse/core/util'

import { incWithProbabilities } from './util'
import { createEmptyBin } from './processDepth'
import { parseCigar2 } from '../MismatchParser'
import { getMaxProbModAtEachPosition } from '../shared/getMaximumModificationAtEachPosition'
import { CAT_MOD, CAT_NONMOD } from '../shared/types'

import type { ColorBy, FlatBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export function processModifications({
  feature,
  colorBy,
  region,
  bins,
  regionSequence,
}: {
  bins: FlatBaseCoverageBin[]
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
  const modificationThreshold = colorBy?.modifications?.threshold ?? 10
  const thresholdFraction = modificationThreshold / 100

  if (!seq) {
    return
  }

  const cigarOps = parseCigar2(feature.get('CIGAR'))

  // eslint-disable-next-line unicorn/no-array-for-each
  getMaxProbModAtEachPosition(feature, cigarOps)?.forEach(
    ({ allProbs, prob, type }, pos) => {
      if (isolatedModification && type !== isolatedModification) {
        return
      }

      if (prob < thresholdFraction) {
        return
      }

      const epos = pos + fstart - region.start
      if (epos >= 0 && epos < bins.length && pos + fstart < fend) {
        if (bins[epos] === undefined) {
          bins[epos] = createEmptyBin()
        }

        const bin = bins[epos]
        bin.refbase = regionSequence[epos]

        const s = 1 - sum(allProbs)
        if (twoColor && s > max(allProbs)) {
          incWithProbabilities(bin, fstrand, CAT_NONMOD + type, s)
        } else {
          incWithProbabilities(bin, fstrand, CAT_MOD + type, prob)
        }
      }
    },
  )
}

import { max, sum } from '@jbrowse/core/util'

import { createEmptyBin, incWithProbabilities } from './util.ts'
import { parseCigar2 } from '../MismatchParser/index.ts'
import { getMaxProbModAtEachPosition } from '../shared/getMaximumModificationAtEachPosition.ts'

import type { ColorBy, PreBaseCoverageBin } from '../shared/types.ts'
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
  const modificationThreshold = colorBy?.modifications?.threshold ?? 10
  const thresholdFraction = modificationThreshold / 100

  if (!seq) {
    return
  }

  const cigarOps =
    feature.get('NUMERIC_CIGAR') ?? parseCigar2(feature.get('CIGAR'))
  const regionStart = region.start
  const regionEnd = region.end

  // Get only the maximum probability modification at each position
  // this is a hole-y array, does not work with normal for loop
  // eslint-disable-next-line unicorn/no-array-for-each
  getMaxProbModAtEachPosition(feature, cigarOps)?.forEach(
    ({ allProbs, prob, type }, pos) => {
      const refPos = pos + fstart

      // Skip positions outside visible region (early check before other work)
      if (refPos < regionStart || refPos >= fend) {
        return
      }
      const epos = refPos - regionStart
      if (epos < 0 || epos >= regionEnd - regionStart) {
        return
      }

      if (isolatedModification && type !== isolatedModification) {
        return
      }

      // Check if modification probability exceeds threshold
      if (prob < thresholdFraction) {
        return
      }

      const bin = (bins[epos] ??= createEmptyBin())
      bin.refbase = regionSequence[epos]

      const s = 1 - sum(allProbs)
      if (twoColor && s > max(allProbs)) {
        incWithProbabilities(bin, fstrand, 'nonmods', `nonmod_${type}`, s)
      } else {
        incWithProbabilities(bin, fstrand, 'mods', `mod_${type}`, prob)
      }
    },
  )
}

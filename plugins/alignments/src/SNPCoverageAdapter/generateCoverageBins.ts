import { forEachWithStopTokenCheck, sum } from '@jbrowse/core/util'

import { processDepth } from './processDepth'
import { processMismatches } from './processMismatches'
import { processModifications } from './processModifications'
import { processReferenceCpGs } from './processReferenceCpGs'

import type { Opts } from './util'
import type { PreBaseCoverageBin, SkipMap } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export async function generateCoverageBins({
  fetchSequence,
  features,
  region,
  opts,
}: {
  features: Feature[]
  region: Region
  opts: Opts
  fetchSequence: (arg: Region) => Promise<string>
}) {
  const { stopToken, colorBy } = opts
  const skipmap = {} as SkipMap
  const bins = [] as PreBaseCoverageBin[]
  const start2 = Math.max(0, region.start - 1)
  const diff = region.start - start2

  // Fetch sequence once outside the loop if needed for modifications or methylation
  let regionSequence = ''
  if (colorBy?.type === 'modifications' || colorBy?.type === 'methylation') {
    regionSequence =
      (await fetchSequence({
        ...region,
        start: start2,
        end: region.end + 1,
      })) || ''
  }

  forEachWithStopTokenCheck(features, stopToken, feature => {
    processDepth({
      feature,
      bins,
      region,
    })

    if (colorBy?.type === 'modifications') {
      processModifications({
        feature,
        colorBy,
        bins,
        region,
        regionSequence: regionSequence.slice(diff),
      })
    } else if (colorBy?.type === 'methylation') {
      processReferenceCpGs({
        feature,
        bins,
        region,
        regionSequence,
      })
    }
    processMismatches({ feature, skipmap, bins, region })
  })

  for (const bin of bins) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (bin) {
      bin.mods = Object.fromEntries(
        Object.entries(bin.mods).map(([key, val]) => {
          return [
            key,
            {
              ...val,
              avgProbability: val.probabilities.length
                ? sum(val.probabilities) / val.probabilities.length
                : undefined,
            },
          ] as const
        }),
      )
      bin.nonmods = Object.fromEntries(
        Object.entries(bin.nonmods).map(([key, val]) => {
          return [
            key,
            {
              ...val,
              avgProbability: val.probabilities.length
                ? sum(val.probabilities) / val.probabilities.length
                : undefined,
            },
          ] as const
        }),
      )
    }
  }

  return {
    bins,
    skipmap,
  }
}

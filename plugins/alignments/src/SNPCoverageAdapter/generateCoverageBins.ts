import { sum } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

// locals
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
  const regionSequence =
    (await fetchSequence({
      ...region,
      start: start2,
      end: region.end + 1,
    })) || ''
  let start = performance.now()
  for (const feature of features) {
    if (performance.now() - start > 400) {
      checkStopToken(stopToken)
      start = performance.now()
    }
    processDepth({
      feature,
      bins,
      region,
      regionSequence: regionSequence.slice(diff),
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
  }

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

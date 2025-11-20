import { sum } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { processDepthOptimized } from './processDepthOptimized'
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
  const t0 = performance.now()
  const { stopToken, colorBy } = opts
  const skipmap = {} as SkipMap
  const bins = [] as PreBaseCoverageBin[]
  const start2 = Math.max(0, region.start - 1)
  const diff = region.start - start2

  // Use optimized mosdepth-style algorithm for depth calculation
  // This processes all features at once instead of per-feature iteration
  const t1 = performance.now()
  processDepthOptimized({
    features,
    bins,
    region,
  })
  const t2 = performance.now()
  console.log(`[PERF] processDepthOptimized: ${(t2 - t1).toFixed(2)}ms for ${features.length} features`)

  let regionSequence
  let start = performance.now()
  const t3 = performance.now()
  for (const feature of features) {
    if (performance.now() - start > 400) {
      checkStopToken(stopToken)
      start = performance.now()
    }

    if (colorBy?.type === 'modifications') {
      regionSequence ??=
        (await fetchSequence({
          ...region,
          start: start2,
          end: region.end + 1,
        })) || ''

      processModifications({
        feature,
        colorBy,
        bins,
        region,
        regionSequence: regionSequence.slice(diff),
      })
    } else if (colorBy?.type === 'methylation') {
      regionSequence ??=
        (await fetchSequence({
          ...region,
          start: start2,
          end: region.end + 1,
        })) || ''

      processReferenceCpGs({
        feature,
        bins,
        region,
        regionSequence,
      })
    }
    processMismatches({ feature, skipmap, bins, region })
  }
  const t4 = performance.now()
  console.log(`[PERF] processMismatches loop: ${(t4 - t3).toFixed(2)}ms for ${features.length} features`)

  const t5 = performance.now()
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
  const t6 = performance.now()
  const totalTime = t6 - t0
  console.log(`[PERF] postProcess bins: ${(t6 - t5).toFixed(2)}ms`)
  console.log(`[PERF] TOTAL generateCoverageBins: ${totalTime.toFixed(2)}ms`)

  return {
    bins,
    skipmap,
  }
}

import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { processDepth } from './processDepth'
import { processMismatches } from './processMismatches'
import { processModifications } from './processModifications'
import { processReferenceCpGs } from './processReferenceCpGs'

import type { Opts } from './util'
import type { FlatBaseCoverageBin, SkipMap } from '../shared/types'
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
  fetchSequence: (arg: Region) => Promise<string | undefined>
}) {
  const { stopToken, colorBy } = opts
  const skipmap = {} as SkipMap
  const bins = [] as FlatBaseCoverageBin[]
  const start2 = Math.max(0, region.start - 1)
  const diff = region.start - start2

  let regionSequence: string | undefined
  let slicedSequence: string | undefined
  let start = performance.now()
  for (const feature of features) {
    if (performance.now() - start > 400) {
      checkStopToken(stopToken)
      start = performance.now()
    }
    processDepth({ feature, bins, region })

    if (colorBy?.type === 'modifications') {
      if (regionSequence === undefined) {
        regionSequence =
          (await fetchSequence({
            ...region,
            start: start2,
            end: region.end + 1,
          })) || ''
        slicedSequence = regionSequence.slice(diff)
      }

      processModifications({
        feature,
        colorBy,
        bins,
        region,
        regionSequence: slicedSequence!,
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

  return { bins, skipmap }
}

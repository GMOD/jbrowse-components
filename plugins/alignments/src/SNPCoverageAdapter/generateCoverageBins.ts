import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { processDepth } from './processDepth'
import { processMismatches } from './processMismatches'
import { processModifications } from './processModifications'
import { processReferenceCpGs } from './processReferenceCpGs'
import { parseCigar } from '../MismatchParser'

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

  let regionSequence: string | undefined
  let slicedRegionSequence: string | undefined

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
    })

    if (colorBy?.type === 'modifications') {
      if (!slicedRegionSequence) {
        regionSequence ??=
          (await fetchSequence({
            ...region,
            start: start2,
            end: region.end + 1,
          })) || ''
        slicedRegionSequence = regionSequence.slice(diff)
      }

      const cigarOps = parseCigar(feature.get('CIGAR'))

      processModifications({
        feature,
        colorBy,
        bins,
        region,
        regionSequence: slicedRegionSequence,
        cigarOps,
      })
    } else if (colorBy?.type === 'methylation') {
      if (!regionSequence) {
        regionSequence =
          (await fetchSequence({
            ...region,
            start: start2,
            end: region.end + 1,
          })) || ''
      }

      const cigarOps = parseCigar(feature.get('CIGAR'))

      processReferenceCpGs({
        feature,
        bins,
        region,
        regionSequence,
        cigarOps,
      })
    }
    processMismatches({ feature, skipmap, bins, region })
  }

  // Calculate avgProbability values and convert to final format
  for (const bin of bins) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (bin) {
      bin.mods = Object.fromEntries(
        Object.entries(bin.mods).map(([key, val]) => {
          return [
            key,
            {
              entryDepth: val.entryDepth,
              '-1': val['-1'],
              '0': val['0'],
              '1': val['1'],
              avgProbability:
                val.probabilityCount > 0
                  ? val.probabilitySum / val.probabilityCount
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
              entryDepth: val.entryDepth,
              '-1': val['-1'],
              '0': val['0'],
              '1': val['1'],
              avgProbability:
                val.probabilityCount > 0
                  ? val.probabilitySum / val.probabilityCount
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

import { sum } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

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
  const needsSequence =
    colorBy?.type === 'modifications' || colorBy?.type === 'methylation'

  let regionSequence: string | undefined
  if (needsSequence) {
    regionSequence =
      (await fetchSequence({
        ...region,
        start: start2,
        end: region.end + 1,
      })) || ''
  }

  let start = performance.now()
  const featuresLength = features.length
  for (let fi = 0; fi < featuresLength; fi++) {
    const feature = features[fi]!
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
      processModifications({
        feature,
        colorBy,
        bins,
        region,
        regionSequence: regionSequence!.slice(diff),
      })
    } else if (colorBy?.type === 'methylation') {
      processReferenceCpGs({
        feature,
        bins,
        region,
        regionSequence: regionSequence!,
      })
    }
    processMismatches({ feature, skipmap, bins, region })
  }

  const binsLength = bins.length
  for (let bi = 0; bi < binsLength; bi++) {
    const bin = bins[bi]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (bin) {
      const modEntries = Object.entries(bin.mods)
      const modEntriesLen = modEntries.length
      for (let i = 0; i < modEntriesLen; i++) {
        const val = modEntries[i]![1]
        const probs = val.probabilities
        const probsLen = probs.length
        if (probsLen) {
          ;(val as any).avgProbability = sum(probs) / probsLen
        }
      }
      const nonmodEntries = Object.entries(bin.nonmods)
      const nonmodEntriesLen = nonmodEntries.length
      for (let i = 0; i < nonmodEntriesLen; i++) {
        const val = nonmodEntries[i]![1]
        const probs = val.probabilities
        const probsLen = probs.length
        if (probsLen) {
          ;(val as any).avgProbability = sum(probs) / probsLen
        }
      }
    }
  }

  return {
    bins,
    skipmap,
  }
}

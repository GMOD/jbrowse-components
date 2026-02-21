import { clusterData, toNewick } from '@gmod/hclust'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { getGenotypeMatrix } from './getGenotypeMatrix.ts'
import { getPhasedGenotypeMatrix } from './getPhasedGenotypeMatrix.ts'

import type { SampleInfo, Source } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, StopToken } from '@jbrowse/core/util'

export async function executeClusterGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: {
    adapterConfig: AnyConfigurationModel
    stopToken?: StopToken
    sessionId: string
    headers?: Record<string, string>
    regions: Region[]
    bpPerPx: number
    minorAlleleFrequencyFilter: number
    lengthCutoffFilter: number
    statusCallback: (arg: string) => void
    sources: Source[]
    renderingMode?: string
    sampleInfo?: Record<string, SampleInfo>
  }
}) {
  const { renderingMode, sampleInfo, stopToken } = args
  const stopTokenCheck = createStopTokenChecker(stopToken)
  const argsWithCheck = { ...args, stopTokenCheck }
  const matrix =
    renderingMode === 'phased' && sampleInfo
      ? await getPhasedGenotypeMatrix({
          pluginManager,
          args: { ...argsWithCheck, sampleInfo, statusCallback: args.statusCallback },
        })
      : await getGenotypeMatrix({
          pluginManager,
          args: { ...argsWithCheck, statusCallback: args.statusCallback },
        })
  const sampleLabels = Object.keys(matrix)
  const result = await clusterData({
    data: Object.values(matrix),
    sampleLabels,
    stopToken: args.stopToken,
    onProgress: args.statusCallback,
  })
  return {
    order: result.order,
    tree: toNewick(result.tree),
  }
}

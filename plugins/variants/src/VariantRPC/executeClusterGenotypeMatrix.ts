import { clusterData, toNewick } from '@gmod/hclust'

import { getGenotypeMatrix } from './getGenotypeMatrix.ts'

import type { Source } from '../shared/types.ts'
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
  }
}) {
  const matrix = await getGenotypeMatrix({
    pluginManager,
    args,
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

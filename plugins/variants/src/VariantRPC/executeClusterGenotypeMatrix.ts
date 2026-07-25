import { clusterObject, toNewick } from '@gmod/hclust'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { clusterProgressStatus } from '@jbrowse/tree-sidebar'

import { buildGenotypeMatrix } from './buildGenotypeMatrix.ts'
import { imputeMissingToSiteMean } from './genotypeMatrixEncoding.ts'

import type { SampleInfo, Source } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Region, StatusCallback, StopToken } from '@jbrowse/core/util'

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
    bpPerPx?: number
    minorAlleleFrequencyFilter: number
    maxMissingnessFilter: number
    filters?: SerializableFilterChain
    statusCallback: StatusCallback
    sources: Source[]
    renderingMode?: string
    sampleInfo?: Record<string, SampleInfo>
  }
}) {
  const stopTokenCheck = createStopTokenChecker(args.stopToken)
  const matrix = await buildGenotypeMatrix({
    pluginManager,
    args: { ...args, stopTokenCheck },
  })
  const result = await clusterObject({
    // hclust rejects non-finite input outright, so the no-calls the builders
    // mark with NaN have to become numbers here. Site-mean imputation makes
    // them contribute nothing to the distance rather than dominating it.
    data: imputeMissingToSiteMean(matrix),
    onProgress: p => {
      args.statusCallback(clusterProgressStatus(p))
    },
    checkCancellation: () => {
      checkStopToken2(stopTokenCheck)
    },
  })
  return {
    order: result.order,
    tree: toNewick(result.tree),
  }
}

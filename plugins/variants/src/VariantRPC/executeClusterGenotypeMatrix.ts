import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'
import { clusterMatrix } from '@jbrowse/tree-sidebar'

import { buildGenotypeMatrix } from './buildGenotypeMatrix.ts'
import { imputeMissingToSiteMean } from './genotypeMatrixEncoding.ts'

import type { ClusterGenotypeMatrixArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcHandles } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeClusterGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: ClusterGenotypeMatrixArgs & RpcHandles
}) {
  const stopTokenCheck = createStopTokenChecker(args.stopToken)
  const matrix = await buildGenotypeMatrix({
    pluginManager,
    args: { ...args, stopTokenCheck },
  })
  return clusterMatrix({
    // hclust rejects non-finite input outright, so the no-calls the builders
    // mark with NaN have to become numbers here. Site-mean imputation makes
    // them contribute nothing to the distance rather than dominating it.
    data: imputeMissingToSiteMean(matrix),
    statusCallback: args.statusCallback,
    stopTokenCheck,
  })
}

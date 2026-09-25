import { clusterMatrix } from '@jbrowse/tree-sidebar/clusterMatrix'

import { buildGenotypeMatrix } from './buildGenotypeMatrix.ts'
import { imputeMissingToSiteMean } from './genotypeMatrixEncoding.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeClusterGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'MultiSampleVariantClusterGenotypeMatrix'>
}) {
  const matrix = await buildGenotypeMatrix({
    pluginManager,
    args,
  })
  return clusterMatrix({
    // hclust rejects non-finite input outright, so the no-calls the builders
    // mark with NaN have to become numbers here. Site-mean imputation makes
    // them contribute nothing to the distance rather than dominating it.
    data: imputeMissingToSiteMean(matrix),
    partition: args.partition,
    statusCallback: args.statusCallback,
    signal: args.signal,
  })
}

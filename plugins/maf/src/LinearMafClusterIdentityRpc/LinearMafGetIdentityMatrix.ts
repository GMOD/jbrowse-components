import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { LinearMafClusterIdentityMatrixArgs } from './LinearMafClusterIdentityMatrix.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { ClusterMatrix } from '@jbrowse/tree-sidebar'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetIdentityMatrix: {
      args: LinearMafClusterIdentityMatrixArgs
      return: ClusterMatrix
    }
  }
}

/**
 * The same matrix the clustering method runs on, without the clustering step —
 * what the dialog's manual tab exports as a TSV for an R script to cluster. One
 * builder behind both, so the tree pasted back describes the rows the auto tab
 * would have produced rather than a second matrix built to different rules.
 */
export default class LinearMafGetIdentityMatrix extends RpcMethodTypeWithFiltersAndRenameRegions<'LinearMafGetIdentityMatrix'> {
  name = 'LinearMafGetIdentityMatrix' as const

  async execute(args: RpcExecuteArgs<'LinearMafGetIdentityMatrix'>) {
    const { buildIdentityMatrix } = await import('./buildIdentityMatrix.ts')
    const { createStopTokenChecker } =
      await import('@jbrowse/core/util/stopToken')
    return buildIdentityMatrix({
      pluginManager: this.pluginManager,
      args: { ...args, stopTokenCheck: createStopTokenChecker(args.stopToken) },
    })
  }
}

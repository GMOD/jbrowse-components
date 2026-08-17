import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { BaseMafRpcArgs } from '../types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export interface LinearMafClusterIdentityMatrixArgs extends BaseMafRpcArgs {
  // The rows to cluster, in the order the display holds them: the returned
  // `order` is indices into this list. It is the display's VISIBLE set rather
  // than every genome in the file, because the tree has to name exactly the
  // drawn rows or `computeClusterHierarchy` refuses it and no dendrogram is
  // drawn -- so a run under an active subtree filter clusters within the
  // subtree, which is also the more useful answer.
  sources: string[]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafClusterIdentityMatrix: {
      args: LinearMafClusterIdentityMatrixArgs
      return: { order: number[]; tree: string }
    }
  }
}

export default class LinearMafClusterIdentityMatrix extends RpcMethodTypeWithFiltersAndRenameRegions<'LinearMafClusterIdentityMatrix'> {
  name = 'LinearMafClusterIdentityMatrix' as const

  async execute(args: RpcExecuteArgs<'LinearMafClusterIdentityMatrix'>) {
    const { executeClusterIdentityMatrix } =
      await import('./executeClusterIdentityMatrix.ts')
    return executeClusterIdentityMatrix({
      pluginManager: this.pluginManager,
      args,
    })
  }
}

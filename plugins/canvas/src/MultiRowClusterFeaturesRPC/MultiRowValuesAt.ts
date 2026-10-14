import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import { rowValuesAt } from './rowValuesAt.ts'

import type { MultiRowValuesAtArgs } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowValuesAt: {
      args: MultiRowValuesAtArgs
      return: Map<string, string>
    }
  }
}

export default class MultiRowValuesAt extends RpcMethodTypeWithRenameRegions<'MultiRowValuesAt'> {
  name = 'MultiRowValuesAt' as const

  async execute(args: RpcExecuteArgs<'MultiRowValuesAt'>) {
    const { collectMatrixFeatures } = await import('./collectMultiRowMatrix.ts')
    return rowValuesAt(
      await collectMatrixFeatures({ pluginManager: this.pluginManager, args }),
      args.pos,
    )
  }
}

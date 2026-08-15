import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export default class MultiRowGetFeatures extends RpcMethodTypeWithRenameRegion<'MultiRowGetFeatures'> {
  name = 'MultiRowGetFeatures' as const

  async execute(args: RpcExecuteArgs<'MultiRowGetFeatures'>) {
    const { executeMultiRowGetFeatures } =
      await import('./executeMultiRowGetFeatures.ts')
    return executeMultiRowGetFeatures({
      pluginManager: this.pluginManager,
      args,
    })
  }
}

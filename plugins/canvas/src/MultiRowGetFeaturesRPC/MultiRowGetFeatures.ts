import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { MultiRowGetFeaturesArgs } from './rpcTypes.ts'

export default class MultiRowGetFeatures extends RpcMethodTypeWithRenameRegion<'MultiRowGetFeatures'> {
  name = 'MultiRowGetFeatures' as const

  async execute(args: MultiRowGetFeaturesArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeMultiRowGetFeatures } =
      await import('./executeMultiRowGetFeatures.ts')
    return executeMultiRowGetFeatures({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}

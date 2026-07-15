import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { MultiRowGetFeaturesArgs } from './rpcTypes.ts'

export default class MultiRowGetFeatures extends RpcMethodTypeWithRenameRegion {
  name = 'MultiRowGetFeatures'

  async execute(args: MultiRowGetFeaturesArgs, _rpcDriver: string) {
    const { executeMultiRowGetFeatures } =
      await import('./executeMultiRowGetFeatures.ts')
    return executeMultiRowGetFeatures({
      pluginManager: this.pluginManager,
      args,
    })
  }
}

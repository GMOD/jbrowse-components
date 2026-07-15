import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { RenderFeatureDataArgs } from './rpcTypes.ts'

export default class RenderFeatureData extends RpcMethodTypeWithRenameRegion {
  name = 'RenderFeatureData'

  async execute(args: RenderFeatureDataArgs, _rpcDriver: string) {
    const { executeRenderFeatureData } =
      await import('./executeRenderFeatureData.ts')
    return executeRenderFeatureData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}

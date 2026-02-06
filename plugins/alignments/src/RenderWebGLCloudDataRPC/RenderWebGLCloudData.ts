import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

interface RenderWebGLCloudDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  region: Region
  filterBy?: Record<string, unknown>
  height: number
}

export default class RenderWebGLCloudData extends RpcMethodType {
  name = 'RenderWebGLCloudData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderWebGLCloudDataArgs
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (assemblyManager) {
      const result = await renameRegionsIfNeeded(assemblyManager, {
        sessionId: typedArgs.sessionId,
        adapterConfig: typedArgs.adapterConfig,
        regions: [typedArgs.region],
      })

      return super.serializeArguments(
        {
          ...typedArgs,
          region: result.regions[0],
        } as unknown as Record<string, unknown>,
        rpcDriver,
      )
    }

    return super.serializeArguments(args, rpcDriver)
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderWebGLCloudData } =
      await import('./executeRenderWebGLCloudData.ts')
    return executeRenderWebGLCloudData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLCloudDataArgs,
    })
  }
}

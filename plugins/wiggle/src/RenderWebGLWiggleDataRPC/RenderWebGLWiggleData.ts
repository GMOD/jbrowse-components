import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

interface RenderWebGLWiggleDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
}

export default class RenderWebGLWiggleData extends RpcMethodType {
  name = 'RenderWebGLWiggleData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderWebGLWiggleDataArgs
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (assemblyManager && typedArgs.region) {
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
    const { executeRenderWebGLWiggleData } =
      await import('./executeRenderWebGLWiggleData.ts')
    return executeRenderWebGLWiggleData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLWiggleDataArgs,
    })
  }
}

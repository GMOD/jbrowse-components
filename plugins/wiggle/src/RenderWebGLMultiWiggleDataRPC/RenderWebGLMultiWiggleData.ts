import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

interface SourceInfo {
  name: string
  color?: string
}

interface RenderWebGLMultiWiggleDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
  sources?: SourceInfo[]
  bicolorPivot?: number
}

export default class RenderWebGLMultiWiggleData extends RpcMethodType {
  name = 'RenderWebGLMultiWiggleData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderWebGLMultiWiggleDataArgs
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
    const { executeRenderWebGLMultiWiggleData } =
      await import('./executeRenderWebGLMultiWiggleData.ts')
    return executeRenderWebGLMultiWiggleData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLMultiWiggleDataArgs,
    })
  }
}

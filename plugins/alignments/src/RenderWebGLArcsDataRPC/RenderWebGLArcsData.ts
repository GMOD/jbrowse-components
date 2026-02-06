import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { ColorBy } from '../shared/types.ts'
import type { Region } from '@jbrowse/core/util'

interface RenderWebGLArcsDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  region: Region
  filterBy?: Record<string, unknown>
  colorBy: ColorBy
  height: number
  drawInter: boolean
  drawLongRange: boolean
}

export default class RenderWebGLArcsData extends RpcMethodType {
  name = 'RenderWebGLArcsData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderWebGLArcsDataArgs
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
    const { executeRenderWebGLArcsData } =
      await import('./executeRenderWebGLArcsData.ts')
    return executeRenderWebGLArcsData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLArcsDataArgs,
    })
  }
}

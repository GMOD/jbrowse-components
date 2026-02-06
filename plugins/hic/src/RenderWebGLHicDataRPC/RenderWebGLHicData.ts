import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

interface RenderWebGLHicDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  resolution: number
  normalization: string
  displayHeight?: number
  mode?: string
}

export default class RenderWebGLHicData extends RpcMethodType {
  name = 'RenderWebGLHicData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderWebGLHicDataArgs
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (assemblyManager && typedArgs.regions?.length) {
      const result = await renameRegionsIfNeeded(assemblyManager, {
        sessionId: typedArgs.sessionId,
        adapterConfig: typedArgs.adapterConfig,
        regions: typedArgs.regions,
      })

      return super.serializeArguments(
        {
          ...typedArgs,
          regions: result.regions,
        } as unknown as Record<string, unknown>,
        rpcDriver,
      )
    }

    return super.serializeArguments(args, rpcDriver)
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderWebGLHicData } = await import(
      './executeRenderWebGLHicData.ts'
    )
    return executeRenderWebGLHicData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLHicDataArgs,
    })
  }
}

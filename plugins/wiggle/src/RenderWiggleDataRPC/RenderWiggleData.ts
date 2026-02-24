import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

interface RenderWiggleDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
  bicolorPivot?: number
}

export default class RenderWiggleData extends RpcMethodType {
  name = 'RenderWiggleData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderWiggleDataArgs
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
    const { executeRenderWiggleData } =
      await import('./executeRenderWiggleData.ts')
    return executeRenderWiggleData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWiggleDataArgs,
    })
  }
}

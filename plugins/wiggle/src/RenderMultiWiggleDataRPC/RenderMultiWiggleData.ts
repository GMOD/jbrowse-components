import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { SourceInfo } from '../util.ts'
import type { Region } from '@jbrowse/core/util'

interface RenderMultiWiggleDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
  sources?: SourceInfo[]
  bicolorPivot?: number
}

export default class RenderMultiWiggleData extends RpcMethodType {
  name = 'RenderMultiWiggleData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderMultiWiggleDataArgs
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
    const { executeRenderMultiWiggleData } =
      await import('./executeRenderMultiWiggleData.ts')
    return executeRenderMultiWiggleData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderMultiWiggleDataArgs,
    })
  }
}

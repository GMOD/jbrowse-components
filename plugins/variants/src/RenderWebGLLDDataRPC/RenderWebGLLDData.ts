import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

interface RenderWebGLLDDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  ldMetric: string
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  hweFilterThreshold: number
  callRateFilter: number
  jexlFilters: string[]
  signedLD: boolean
  useGenomicPositions: boolean
  fitToHeight: boolean
  displayHeight?: number
  stopToken?: string
}

export default class RenderWebGLLDData extends RpcMethodType {
  name = 'RenderWebGLLDData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderWebGLLDDataArgs
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (assemblyManager && typedArgs.regions.length) {
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
    const { executeRenderWebGLLDData } =
      await import('./executeRenderWebGLLDData.ts')
    return executeRenderWebGLLDData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLLDDataArgs,
    })
  }
}

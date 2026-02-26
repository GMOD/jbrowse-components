import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { LDDataResult } from './types.ts'
import type { LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderLDData: {
      args: Record<string, unknown>
      return: LDDataResult
    }
  }
}

interface RenderLDDataArgs {
  sessionId: string
  adapterConfig: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  ldMetric: LDMetric
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

export default class RenderLDData extends RpcMethodType {
  name = 'RenderLDData'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const typedArgs = args as unknown as RenderLDDataArgs
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
    const { executeRenderLDData } = await import('./executeRenderLDData.ts')
    return executeRenderLDData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderLDDataArgs,
    })
  }
}

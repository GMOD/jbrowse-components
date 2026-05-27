import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { LDDataResult } from './types.ts'
import type { LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface RenderLDDataArgs {
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
  stopToken?: StopToken
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderLDData: {
      args: RenderLDDataArgs
      return: LDDataResult
    }
  }
}

export default class RenderLDData extends RpcMethodType {
  name = 'RenderLDData'

  async serializeArguments(args: RenderLDDataArgs, rpcDriver: string) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (assemblyManager && args.regions.length) {
      const { regions } = await renameRegionsIfNeeded(assemblyManager, {
        sessionId: args.sessionId,
        adapterConfig: args.adapterConfig,
        regions: args.regions,
      })

      return super.serializeArguments({ ...args, regions }, rpcDriver)
    }

    return super.serializeArguments(args, rpcDriver)
  }

  async execute(args: RenderLDDataArgs, _rpcDriver: string) {
    const { executeRenderLDData } = await import('./executeRenderLDData.ts')
    return executeRenderLDData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}

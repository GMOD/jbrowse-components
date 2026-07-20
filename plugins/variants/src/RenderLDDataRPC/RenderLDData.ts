import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type { LDDataResult } from './types.ts'
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

export default class RenderLDData extends RpcMethodTypeWithRenameRegions {
  name = 'RenderLDData'

  async execute(args: RenderLDDataArgs, _rpcDriver: string) {
    const { executeRenderLDData } = await import('./executeRenderLDData.ts')
    return executeRenderLDData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}

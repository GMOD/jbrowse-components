import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type {
  RenderFeatureDataArgs,
  RenderFeatureDataResult,
} from './rpcTypes.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderFeatureData: {
      args: RenderFeatureDataArgs
      return: RenderFeatureDataResult
    }
  }
}

export default class RenderFeatureData extends RpcMethodType {
  name = 'RenderFeatureData'

  async renameRegionsIfNeeded(
    args: RenderFeatureDataArgs,
  ): Promise<RenderFeatureDataArgs> {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const { region, sessionId, adapterConfig } = args

    const result = await renameRegionsIfNeeded(assemblyManager, {
      sessionId,
      adapterConfig,
      regions: [region],
    })

    // single-region RPC: we pass one region in, get one back
    const renamedRegion = result.regions[0]
    if (!renamedRegion) {
      return args
    }

    let seqAdapterRefName: string | undefined
    const { sequenceAdapter } = args
    if (sequenceAdapter) {
      const seqResult = await renameRegionsIfNeeded(assemblyManager, {
        sessionId,
        adapterConfig: sequenceAdapter,
        regions: [region],
      })
      seqAdapterRefName = seqResult.regions[0]?.refName
    }

    return {
      ...args,
      region: {
        ...renamedRegion,
        seqAdapterRefName,
      },
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as RenderFeatureDataArgs,
    )
    return super.serializeArguments(renamed as Record<string, unknown>, rpcDriver)
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderFeatureData } =
      await import('./executeRenderFeatureData.ts')
    return executeRenderFeatureData({
      pluginManager: this.pluginManager,
      args: args as RenderFeatureDataArgs,
    })
  }
}

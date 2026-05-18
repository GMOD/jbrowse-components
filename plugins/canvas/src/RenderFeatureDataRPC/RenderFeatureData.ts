import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { renameSingleRegion } from './renameRegion.ts'

import type { RenderFeatureDataArgs } from './rpcTypes.ts'

export default class RenderFeatureData extends RpcMethodType {
  name = 'RenderFeatureData'

  async renameRegionsIfNeeded(
    args: RenderFeatureDataArgs,
  ): Promise<RenderFeatureDataArgs> {
    const { region, sessionId, adapterConfig, sequenceAdapter } = args
    const renamedRegion = await renameSingleRegion(this.pluginManager, {
      sessionId,
      adapterConfig,
      region,
    })
    if (!renamedRegion) {
      return args
    }
    const seqAdapterRefName = sequenceAdapter
      ? (
          await renameSingleRegion(this.pluginManager, {
            sessionId,
            adapterConfig: sequenceAdapter,
            region,
          })
        )?.refName
      : undefined
    return {
      ...args,
      region: {
        ...renamedRegion,
        seqAdapterRefName,
      },
    }
  }

  async serializeArguments(args: RenderFeatureDataArgs, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(args)
    return super.serializeArguments(renamed, rpcDriver)
  }

  async execute(args: RenderFeatureDataArgs, _rpcDriver: string) {
    const { executeRenderFeatureData } =
      await import('./executeRenderFeatureData.ts')
    return executeRenderFeatureData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}

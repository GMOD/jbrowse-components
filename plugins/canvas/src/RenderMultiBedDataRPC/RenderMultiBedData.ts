import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { renameSingleRegion } from '../RenderFeatureDataRPC/renameRegion.ts'

import type { RenderMultiBedDataArgs } from './rpcTypes.ts'

export default class RenderMultiBedData extends RpcMethodType {
  name = 'RenderMultiBedData'

  async renameRegionsIfNeeded(
    args: RenderMultiBedDataArgs,
  ): Promise<RenderMultiBedDataArgs> {
    const { region, sessionId, adapterConfig } = args
    const renamedRegion = await renameSingleRegion(this.pluginManager, {
      sessionId,
      adapterConfig,
      region,
    })
    if (!renamedRegion) {
      return args
    }
    return { ...args, region: renamedRegion }
  }

  async serializeArguments(args: RenderMultiBedDataArgs, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(args)
    return super.serializeArguments(renamed, rpcDriver)
  }

  async execute(args: RenderMultiBedDataArgs, _rpcDriver: string) {
    const { executeRenderMultiBedData } = await import(
      './executeRenderMultiBedData.ts'
    )
    return executeRenderMultiBedData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}

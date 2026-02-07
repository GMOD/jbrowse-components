import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { RenderWebGLPileupDataArgs } from './types'

export default class RenderWebGLPileupData extends RpcMethodType {
  name = 'RenderWebGLPileupData'

  async renameRegionsIfNeeded(
    args: RenderWebGLPileupDataArgs,
  ): Promise<RenderWebGLPileupDataArgs> {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const { region, sessionId, adapterConfig } = args

    const regionWithAssembly = {
      ...region,
      assemblyName: region.assemblyName ?? '',
    }

    const result = await renameRegionsIfNeeded(assemblyManager, {
      sessionId,
      adapterConfig,
      regions: [regionWithAssembly],
    })

    const renamedRegion = result.regions[0]
    if (!renamedRegion) {
      return args
    }

    return {
      ...args,
      region: {
        refName: renamedRegion.refName,
        start: renamedRegion.start,
        end: renamedRegion.end,
        assemblyName: renamedRegion.assemblyName,
      },
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as RenderWebGLPileupDataArgs,
    )
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderWebGLPileupData } =
      await import('./executeRenderWebGLPileupData.ts')
    return executeRenderWebGLPileupData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLPileupDataArgs,
    })
  }
}

import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { RenderWebGLChainDataArgs } from './executeRenderWebGLChainData.ts'

export default class RenderWebGLChainData extends RpcMethodType {
  name = 'RenderWebGLChainData'

  async renameRegionsIfNeeded(
    args: RenderWebGLChainDataArgs,
  ): Promise<RenderWebGLChainDataArgs> {
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
        originalRefName: renamedRegion.originalRefName,
        start: renamedRegion.start,
        end: renamedRegion.end,
        assemblyName: renamedRegion.assemblyName,
      },
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as RenderWebGLChainDataArgs,
    )
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderWebGLChainData } =
      await import('./executeRenderWebGLChainData.ts')
    return executeRenderWebGLChainData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLChainDataArgs,
    })
  }
}

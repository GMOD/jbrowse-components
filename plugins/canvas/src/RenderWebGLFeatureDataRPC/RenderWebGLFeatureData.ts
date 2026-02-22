import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { RenderWebGLFeatureDataArgs } from './rpcTypes.ts'

export default class RenderWebGLFeatureData extends RpcMethodType {
  name = 'RenderWebGLFeatureData'

  async renameRegionsIfNeeded(
    args: RenderWebGLFeatureDataArgs,
  ): Promise<RenderWebGLFeatureDataArgs> {
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

    let seqAdapterRefName: string | undefined
    const { sequenceAdapter } = args
    if (sequenceAdapter) {
      const seqResult = await renameRegionsIfNeeded(assemblyManager, {
        sessionId,
        adapterConfig: sequenceAdapter,
        regions: [regionWithAssembly],
      })
      seqAdapterRefName = seqResult.regions[0]?.refName
    }

    return {
      ...args,
      region: {
        refName: renamedRegion.refName,
        start: renamedRegion.start,
        end: renamedRegion.end,
        assemblyName: renamedRegion.assemblyName,
        seqAdapterRefName,
      },
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as RenderWebGLFeatureDataArgs,
    )
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderWebGLFeatureData } =
      await import('./executeRenderWebGLFeatureData.ts')
    return executeRenderWebGLFeatureData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderWebGLFeatureDataArgs,
    })
  }
}

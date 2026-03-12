import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type {
  RenderFeatureDataArgs,
  RenderFeatureDataResult,
} from './rpcTypes.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderFeatureData: {
      args: Record<string, unknown>
      return: RenderFeatureDataResult
    }
    GetCanvasFeatureDetails: {
      args: Record<string, unknown>
      return: { feature?: SimpleFeatureSerialized }
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
      args as unknown as RenderFeatureDataArgs,
    )
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderFeatureData } =
      await import('./executeRenderFeatureData.ts')
    return executeRenderFeatureData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderFeatureDataArgs,
    })
  }
}

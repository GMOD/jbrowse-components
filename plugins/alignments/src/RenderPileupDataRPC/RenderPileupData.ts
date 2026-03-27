import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { PileupDataResult, RenderPileupDataArgs } from './types'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderPileupData: {
      args: Record<string, unknown>
      return: PileupDataResult
    }
  }
}

export default class RenderPileupData extends RpcMethodType {
  name = 'RenderPileupData'

  async renameRegionsIfNeeded(
    args: RenderPileupDataArgs,
  ): Promise<RenderPileupDataArgs> {
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

    // single-region RPC: we pass one region in, get one back
    const renamedRegion = result.regions[0]
    if (!renamedRegion) {
      return args
    }

    return {
      ...args,
      region: renamedRegion,
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as RenderPileupDataArgs,
    )
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderPileupData } =
      await import('./executeRenderPileupData.ts')
    return executeRenderPileupData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderPileupDataArgs,
    })
  }
}

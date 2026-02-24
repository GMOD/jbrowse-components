import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { RenderPileupDataArgs } from './types'

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

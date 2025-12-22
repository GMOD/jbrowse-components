import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import type { Region } from '@jbrowse/core/util'

export class WiggleGetMultiRegionQuantitativeStats extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'WiggleGetMultiRegionQuantitativeStats'

  async serializeArguments(
    args: RenderArgs & {
      staticBlocks?: Region[]
      stopToken?: string
      statusCallback?: (arg: string) => void
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const assemblyManager = pm.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    // Also rename staticBlocks if present
    let renamedStaticBlocks = args.staticBlocks
    if (args.staticBlocks?.length) {
      const renamed = await renameRegionsIfNeeded(assemblyManager, {
        ...args,
        regions: args.staticBlocks,
      })
      renamedStaticBlocks = renamed.regions
    }

    const baseResult = await super.serializeArguments(args, rpcDriverClassName)
    return {
      ...baseResult,
      staticBlocks: renamedStaticBlocks,
    }
  }

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
      sessionId: string
      headers?: Record<string, string>
      regions: Region[]
      staticBlocks?: Region[]
      bpPerPx: number
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { regions, staticBlocks, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)

    // @ts-expect-error
    return dataAdapter.getMultiRegionQuantitativeStats(regions, {
      ...deserializedArgs,
      staticBlocks,
    })
  }
}

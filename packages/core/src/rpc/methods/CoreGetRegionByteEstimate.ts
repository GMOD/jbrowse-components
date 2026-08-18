import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'
import { largestRegionBytes } from '../byteBudget.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetRegionByteEstimate extends RpcMethodTypeWithRenameRegions<'CoreGetRegionByteEstimate'> {
  name = 'CoreGetRegionByteEstimate' as const

  async execute(args: RpcExecuteArgs<'CoreGetRegionByteEstimate'>) {
    const { adapterConfig, sessionId, regions, scope } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    // "Unmeasurable", not an error: the gate reads undefined as "no byte axis".
    if (!isFeatureAdapter(dataAdapter)) {
      return undefined
    }

    if (scope === 'wholeRequest') {
      return dataAdapter.getRegionByteSize(regions, args)
    }

    return largestRegionBytes(
      await Promise.all(
        regions.map(region => dataAdapter.getRegionByteSize([region], args)),
      ),
    )
  }
}

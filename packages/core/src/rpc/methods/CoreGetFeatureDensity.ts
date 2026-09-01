import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * The density tier's read: features per bin at the view's bp/px for regions the
 * region-too-large gate refused. Answers `undefined` for an adapter with no
 * density source, and the display keeps the banner.
 */
export default class CoreGetFeatureDensity extends RpcMethodTypeWithRenameRegions<'CoreGetFeatureDensity'> {
  name = 'CoreGetFeatureDensity' as const

  async execute(args: RpcExecuteArgs<'CoreGetFeatureDensity'>) {
    const { adapterConfig, sessionId, regions, bpPerPx, stopToken } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    return isFeatureAdapter(dataAdapter)
      ? dataAdapter.getFeatureDensity(regions, {
          bpPerPx,
          stopToken,
          statusCallback: args.statusCallback,
        })
      : undefined
  }
}

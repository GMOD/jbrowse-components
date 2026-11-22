import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'
import { recordAcrossOrigin } from './recordAcrossOrigin.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * The one record with `featureId` among those the adapter holds over
 * `region`, read whole across a circular origin (`recordAcrossOrigin`).
 */
export default class GetBasicFeatureDetails extends RpcMethodTypeWithRenameRegion<'GetBasicFeatureDetails'> {
  name = 'GetBasicFeatureDetails' as const

  async execute(args: RpcExecuteArgs<'GetBasicFeatureDetails'>) {
    const { sessionId, adapterConfig, featureId, region, ...opts } = args

    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })

    const { feature } = await recordAcrossOrigin(
      dataAdapter,
      region,
      featureId,
      opts,
    )
    return { feature }
  }
}

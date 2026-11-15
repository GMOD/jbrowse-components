import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'
import { originHeadId } from '../../util/originCut.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * The one record with `featureId` among those the adapter holds over `region`,
 * read whole across a circular origin, so a piece past the origin finds the
 * feature it was cut from. Picked in the worker: every other record over the
 * region stays there, samples and all.
 */
export default class GetBasicFeatureDetails extends RpcMethodTypeWithRenameRegion<'GetBasicFeatureDetails'> {
  name = 'GetBasicFeatureDetails' as const

  async execute(args: RpcExecuteArgs<'GetBasicFeatureDetails'>) {
    const { sessionId, adapterConfig, featureId, region, ...opts } = args

    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })

    const featuresArray = await dataAdapter.getFeaturesArray(region, {
      ...opts,
      wholeAcrossOrigin: true,
    })

    const headId = originHeadId(featureId)
    const feature =
      featuresArray.find(f => f.id() === featureId) ??
      featuresArray.find(f => f.id() === headId)

    return {
      feature: feature?.toJSON(),
    }
  }
}

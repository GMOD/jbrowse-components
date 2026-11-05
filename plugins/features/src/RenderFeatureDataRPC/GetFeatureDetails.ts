import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'
import { originHeadId } from '@jbrowse/core/util/originCut'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export default class GetFeatureDetails extends RpcMethodTypeWithRenameRegion<'GetBasicFeatureDetails'> {
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

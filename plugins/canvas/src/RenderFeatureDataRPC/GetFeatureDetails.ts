import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export default class GetFeatureDetails extends RpcMethodTypeWithRenameRegion<'GetCanvasFeatureDetails'> {
  name = 'GetCanvasFeatureDetails' as const

  async execute(args: RpcExecuteArgs<'GetCanvasFeatureDetails'>) {
    const { sessionId, adapterConfig, featureId, region, ...opts } = args

    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    const featuresArray = await dataAdapter.getFeaturesArray(region, opts)

    const feature = featuresArray.find(f => f.id() === featureId)

    return {
      feature: feature?.toJSON(),
    }
  }
}

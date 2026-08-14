import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { GetFeatureDetailsArgs } from './rpcTypes.ts'

export default class GetFeatureDetails extends RpcMethodTypeWithRenameRegion {
  name = 'GetCanvasFeatureDetails'

  async execute(args: GetFeatureDetailsArgs, rpcDriverClassName: string) {
    const { sessionId, adapterConfig, featureId, region, ...opts } =
      await this.deserializeArguments(args, rpcDriverClassName)

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

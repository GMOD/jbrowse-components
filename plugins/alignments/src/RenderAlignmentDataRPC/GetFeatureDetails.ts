import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

interface GetFeatureDetailsArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  regions: Region[]
  featureId: string
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetPileupFeatureDetails: {
      args: GetFeatureDetailsArgs
      return: { feature: SimpleFeatureSerialized | undefined }
    }
  }
}

export default class GetFeatureDetails extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'GetPileupFeatureDetails'

  async execute(args: GetFeatureDetailsArgs, _rpcDriver: string) {
    const { sessionId, adapterConfig, sequenceAdapter, regions, featureId } =
      args

    const region = regions[0]!

    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    })

    const features = (await dataAdapter?.getFeaturesArray(region, {})) ?? []

    return {
      feature: features.find(f => f.id() === featureId)?.toJSON(),
    }
  }
}

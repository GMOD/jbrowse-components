import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

interface GetFeatureDetailsArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  regions: Region[]
  featureId: string
  // The detail tier the pileup was fetched at. Feature ids are only comparable
  // within one tier (a tiered PIF adapter numbers its coarse and fine rows from
  // different file offsets), so the lookup has to ask for the same one.
  lodMode?: BaseOptions['lodMode']
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

  async execute(args: GetFeatureDetailsArgs, rpcDriverClassName: string) {
    const {
      sessionId,
      adapterConfig,
      sequenceAdapter,
      regions,
      featureId,
      lodMode,
    } = await this.deserializeArguments(args, rpcDriverClassName)

    const region = regions[0]!

    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    })

    const features =
      (await dataAdapter?.getFeaturesArray(region, { lodMode })) ?? []

    return {
      feature: features.find(f => f.id() === featureId)?.toJSON(),
    }
  }
}

import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

interface GetFeatureDetailsArgs {
  adapterConfig: Record<string, unknown>
  // supplied by renameRegionsIfNeeded during serialization, never by a caller
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

export default class GetFeatureDetails extends RpcMethodTypeWithFiltersAndRenameRegions<'GetPileupFeatureDetails'> {
  name = 'GetPileupFeatureDetails' as const

  async execute(args: RpcExecuteArgs<'GetPileupFeatureDetails'>) {
    const {
      sessionId,
      adapterConfig,
      sequenceAdapter,
      regions,
      featureId,
      lodMode,
      stopToken,
      statusCallback,
    } = args

    const region = regions[0]!

    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    })

    // The handles go to the adapter, not just into the signature: finding one
    // read by id means re-reading the region it was in, which on a deep BAM is
    // the same fetch the pileup does. A fresh opts object here dropped both, so
    // clicking a read started an uncancellable, silent read.
    const features =
      (await dataAdapter?.getFeaturesArray(region, {
        lodMode,
        stopToken,
        statusCallback,
      })) ?? []

    return {
      feature: features.find(f => f.id() === featureId)?.toJSON(),
    }
  }
}

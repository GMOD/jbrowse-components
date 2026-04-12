import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
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

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
      dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
    }

    const features = await firstValueFrom(
      dataAdapter.getFeatures(region, {}).pipe(toArray()),
    )

    return {
      feature: features.find(f => f.id() === featureId)?.toJSON(),
    }
  }
}

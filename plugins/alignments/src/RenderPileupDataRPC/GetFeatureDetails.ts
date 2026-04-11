import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetPileupFeatureDetails: {
      args: Record<string, unknown>
      return: { feature: SimpleFeatureSerialized | undefined }
    }
  }
}

interface GetFeatureDetailsArgs {
  sessionId: string
  adapterConfig: AnyConfigurationModel
  sequenceAdapter?: Record<string, unknown>
  regions: Region[]
  featureId: string
}

export default class GetFeatureDetails extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'GetPileupFeatureDetails'

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { sessionId, adapterConfig, sequenceAdapter, regions, featureId } =
      args as unknown as GetFeatureDetailsArgs

    const region = regions[0]!

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
      dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
    }

    const regionWithAssembly = {
      ...region,
      assemblyName: region.assemblyName ?? '',
    }

    const features = await firstValueFrom(
      dataAdapter.getFeatures(regionWithAssembly, {}).pipe(toArray()),
    )

    return {
      feature: features.find(f => f.id() === featureId)?.toJSON(),
    }
  }
}

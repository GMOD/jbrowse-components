import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { GetFeatureDetailsArgs } from './rpcTypes.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class GetFeatureDetails extends RpcMethodTypeWithRenameRegion {
  name = 'GetCanvasFeatureDetails'

  async execute(args: GetFeatureDetailsArgs, _rpcDriver: string) {
    const { sessionId, adapterConfig, featureId, region } = args

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const featuresArray = await firstValueFrom(
      dataAdapter.getFeatures(region).pipe(toArray()),
    )

    const feature = featuresArray.find(f => f.id() === featureId)

    return {
      feature: feature?.toJSON(),
    }
  }
}

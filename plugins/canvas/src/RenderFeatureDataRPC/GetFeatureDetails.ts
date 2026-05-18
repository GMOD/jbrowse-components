import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { renameSingleRegion } from './renameRegion.ts'

import type { GetFeatureDetailsArgs } from './rpcTypes.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class GetFeatureDetails extends RpcMethodType {
  name = 'GetCanvasFeatureDetails'

  async renameRegionsIfNeeded(
    args: GetFeatureDetailsArgs,
  ): Promise<GetFeatureDetailsArgs> {
    const renamedRegion = await renameSingleRegion(this.pluginManager, {
      sessionId: args.sessionId,
      adapterConfig: args.adapterConfig,
      region: args.region,
    })
    return renamedRegion ? { ...args, region: renamedRegion } : args
  }

  async serializeArguments(args: GetFeatureDetailsArgs, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(args)
    return super.serializeArguments(renamed, rpcDriver)
  }

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

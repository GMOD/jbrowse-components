import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

export interface GetFeatureDetailsArgs {
  [key: string]: unknown
  sessionId: string
  adapterConfig: Record<string, unknown>
  featureId: string
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
    reversed?: boolean
  }
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetCanvasFeatureDetails: {
      args: GetFeatureDetailsArgs
      return: { feature?: SimpleFeatureSerialized }
    }
  }
}

export default class GetFeatureDetails extends RpcMethodType {
  name = 'GetCanvasFeatureDetails'

  async renameRegionsIfNeeded(
    args: GetFeatureDetailsArgs,
  ): Promise<GetFeatureDetailsArgs> {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const { region, sessionId, adapterConfig } = args

    const result = await renameRegionsIfNeeded(assemblyManager, {
      sessionId,
      adapterConfig,
      regions: [region],
    })

    // single-region RPC: we pass one region in, get one back
    const renamedRegion = result.regions[0]
    if (!renamedRegion) {
      return args
    }

    return {
      ...args,
      region: renamedRegion,
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as GetFeatureDetailsArgs,
    )
    return super.serializeArguments(renamed as Record<string, unknown>, rpcDriver)
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { sessionId, adapterConfig, featureId, region } =
      args as GetFeatureDetailsArgs

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

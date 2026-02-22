import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export interface GetWebGLFeatureDetailsArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  featureId: string
  region: {
    refName: string
    start: number
    end: number
    assemblyName?: string
  }
}

export default class GetWebGLFeatureDetails extends RpcMethodType {
  name = 'GetWebGLFeatureDetails'

  async renameRegionsIfNeeded(
    args: GetWebGLFeatureDetailsArgs,
  ): Promise<GetWebGLFeatureDetailsArgs> {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const { region, sessionId, adapterConfig } = args

    const regionWithAssembly = {
      ...region,
      assemblyName: region.assemblyName ?? '',
    }

    const result = await renameRegionsIfNeeded(assemblyManager, {
      sessionId,
      adapterConfig,
      regions: [regionWithAssembly],
    })

    const renamedRegion = result.regions[0]
    if (!renamedRegion) {
      return args
    }

    return {
      ...args,
      region: {
        refName: renamedRegion.refName,
        start: renamedRegion.start,
        end: renamedRegion.end,
        assemblyName: renamedRegion.assemblyName,
      },
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as GetWebGLFeatureDetailsArgs,
    )
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { sessionId, adapterConfig, featureId, region } =
      args as unknown as GetWebGLFeatureDetailsArgs

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const regionWithAssembly = {
      ...region,
      assemblyName: region.assemblyName ?? '',
    }

    const featuresArray = await firstValueFrom(
      dataAdapter.getFeatures(regionWithAssembly).pipe(toArray()),
    )

    const feature = featuresArray.find(f => f.id() === featureId)

    return {
      feature: feature?.toJSON(),
    }
  }
}

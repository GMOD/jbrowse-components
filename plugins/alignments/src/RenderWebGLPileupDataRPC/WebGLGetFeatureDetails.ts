import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

interface WebGLGetFeatureDetailsArgs {
  sessionId: string
  adapterConfig: AnyConfigurationModel
  sequenceAdapter?: Record<string, unknown>
  region: {
    refName: string
    start: number
    end: number
    assemblyName?: string
  }
  featureId: string
}

export default class WebGLGetFeatureDetails extends RpcMethodType {
  name = 'WebGLGetFeatureDetails'

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const typedArgs = args as unknown as WebGLGetFeatureDetailsArgs
    const { region, sessionId, adapterConfig } = typedArgs

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
    const renamed = renamedRegion
      ? {
          ...typedArgs,
          region: {
            refName: renamedRegion.refName,
            start: renamedRegion.start,
            end: renamedRegion.end,
            assemblyName: renamedRegion.assemblyName,
          },
        }
      : typedArgs

    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { sessionId, adapterConfig, sequenceAdapter, region, featureId } =
      args as unknown as WebGLGetFeatureDetailsArgs

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

    const feature = features.find(f => f.id() === featureId)

    return {
      feature: feature?.toJSON(),
    }
  }
}

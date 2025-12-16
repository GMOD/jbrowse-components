import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getAdapter } from '../../data_adapters/dataAdapterCache'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '../../util'
import SimpleFeature from '../../util/simpleFeature'

import type { RenderArgs } from './util'
import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter'
import type { Region } from '../../util'
import type { SimpleFeatureSerialized } from '../../util/simpleFeature'

export default class CoreGetFeatures extends RpcMethodType {
  name = 'CoreGetFeatures'

  async deserializeReturn(
    feats: SimpleFeatureSerialized[],
    args: unknown,
    rpcDriver: string,
  ) {
    const superDeserialized = (await super.deserializeReturn(
      feats,
      args,
      rpcDriver,
    )) as SimpleFeatureSerialized[]
    return superDeserialized.map(feat => new SimpleFeature(feat))
  }

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    return super.serializeArguments(
      renamedArgs,
      rpcDriver,
    ) as Promise<RenderArgs>
  }

  async execute(
    args: {
      sessionId: string
      regions: Region[]
      adapterConfig: Record<string, unknown>
      statusCallback: (arg: string) => void
      stopToken?: string
      opts?: any
    },
    rpcDriver: string,
  ) {
    const {
      stopToken,
      statusCallback,
      sessionId,
      adapterConfig,
      regions,
      opts,
    } = await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    console.log('[CoreGetFeatures] adapterConfig.type:', (adapterConfig as any).type, 'sequenceAdapterConfig:', (dataAdapter as any).sequenceAdapterConfig)

    const r = await firstValueFrom(
      dataAdapter
        .getFeaturesInMultipleRegions(regions, {
          ...opts,
          statusCallback,
          stopToken,
        })
        .pipe(toArray()),
    )
    return r.map(f => f.toJSON())
  }
}

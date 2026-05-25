import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'
import { renameRegionsIfNeeded } from '../../util/index.ts'
import SimpleFeature from '../../util/simpleFeature.ts'

import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { Region } from '../../util/index.ts'
import type { SimpleFeatureSerialized } from '../../util/simpleFeature.ts'
import type { StopToken } from '../../util/stopToken.ts'
import type { RpcArgs, RpcReturn } from '../RpcRegistry.ts'

export default class CoreGetFeatures extends RpcMethodType {
  name = 'CoreGetFeatures'

  async deserializeReturn(
    feats: SimpleFeatureSerialized[],
    args: unknown,
    rpcDriver: string,
  ): Promise<RpcReturn<'CoreGetFeatures'>> {
    const superDeserialized = (await super.deserializeReturn(
      feats,
      args,
      rpcDriver,
    )) as SimpleFeatureSerialized[]
    return superDeserialized.map(feat => new SimpleFeature(feat))
  }

  async serializeArguments(
    args: RpcArgs<'CoreGetFeatures'> & { sessionId: string },
    rpcDriver: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    return super.serializeArguments(renamedArgs, rpcDriver)
  }

  async execute(
    args: {
      sessionId: string
      regions: Region[]
      adapterConfig: Record<string, unknown>
      statusCallback: (arg: string) => void
      stopToken?: StopToken
      opts?: Record<string, unknown>
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

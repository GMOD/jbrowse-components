import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

// locals
import { isFeatureAdapter } from '../../data_adapters/BaseAdapter'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '../../util'
import SimpleFeature from '../../util/simpleFeature'
import type { RenderArgs } from './util'
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
      stopToken?: string
      opts?: any
    },
    rpcDriver: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { stopToken, sessionId, adapterConfig, regions, opts } =
      deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Adapter does not support retrieving features')
    }
    const ret = dataAdapter.getFeaturesInMultipleRegions(regions, {
      ...opts,
      stopToken,
    })
    const r = await firstValueFrom(ret.pipe(toArray()))
    return r.map(f => f.toJSON())
  }
}

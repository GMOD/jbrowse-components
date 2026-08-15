import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'
import SimpleFeature from '../../util/simpleFeature.ts'

import type { SimpleFeatureSerialized } from '../../util/simpleFeature.ts'
import type { RpcExecuteArgs, RpcReturn } from '../RpcRegistry.ts'

// The wire return is named rather than left to the registry, because the two
// differ here: `deserializeReturn` below rebuilds each serialized feature into a
// SimpleFeature, so the registry's `Feature[]` is what the caller gets and this
// is what the worker sent.
export default class CoreGetFeatures extends RpcMethodTypeWithRenameRegions<
  'CoreGetFeatures',
  SimpleFeatureSerialized[]
> {
  name = 'CoreGetFeatures' as const

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

  async execute(args: RpcExecuteArgs<'CoreGetFeatures'>, rpcDriver: string) {
    const {
      stopToken,
      statusCallback,
      sessionId,
      adapterConfig,
      sequenceAdapter,
      regions,
      opts,
    } = await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    })

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

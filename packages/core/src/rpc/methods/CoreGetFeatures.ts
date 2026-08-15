import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'
import { unwrapRpcResult } from '../../util/rpc.ts'
import SimpleFeature from '../../util/simpleFeature.ts'

import type { SimpleFeatureSerialized } from '../../util/simpleFeature.ts'
import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetFeatures extends RpcMethodTypeWithRenameRegions<'CoreGetFeatures'> {
  name = 'CoreGetFeatures' as const

  async deserializeReturn(feats: SimpleFeatureSerialized[], _args: unknown) {
    return unwrapRpcResult(feats).map(feat => new SimpleFeature(feat))
  }

  async execute(args: RpcExecuteArgs<'CoreGetFeatures'>) {
    const {
      stopToken,
      statusCallback,
      sessionId,
      adapterConfig,
      sequenceAdapter,
      regions,
      opts,
    } = args

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

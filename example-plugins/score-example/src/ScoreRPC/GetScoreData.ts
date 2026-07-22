import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { buildScoreResult } from './buildScoreResult.ts'

import type { GetScoreDataArgs, ScoreRegionData } from './rpcTypes.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetScoreData: {
      args: GetScoreDataArgs
      return: ScoreRegionData
    }
  }
}

export default class GetScoreData extends RpcMethodType {
  name = 'GetScoreData'

  async execute(args: GetScoreDataArgs, rpcDriverClassName: string) {
    const { sessionId, adapterConfig, region, scoreColumn, stopToken } =
      await this.deserializeArguments(args, rpcDriverClassName)
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })
    const features = await dataAdapter.getFeaturesArray(region, { stopToken })
    return buildScoreResult(features, scoreColumn)
  }
}

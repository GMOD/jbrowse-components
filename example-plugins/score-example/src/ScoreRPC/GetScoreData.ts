// #exampleFile shared | worker: fetch features from the adapter, then pack
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { buildScoreResult } from './buildScoreResult.ts'

import type { GetScoreDataArgs, ScoreRegionData } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// Registering the name here is what types `rpcManager.call(…, 'GetScoreData', …)`
// at every call site: the args are checked and the return type is inferred,
// instead of both being `any`.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetScoreData: {
      args: GetScoreDataArgs
      return: ScoreRegionData
    }
  }
}

export default class GetScoreData extends RpcMethodType<'GetScoreData'> {
  name = 'GetScoreData' as const

  async execute(args: RpcExecuteArgs<'GetScoreData'>) {
    const {
      sessionId,
      adapterConfig,
      region,
      scoreColumn,
      stopToken,
      statusCallback,
    } = args
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })
    // statusCallback arrives as an ordinary function: the caller's never
    // crossed the boundary, the RPC layer replaced it with a side channel and
    // rebuilt one here. Hand it to whatever does the slow work rather than only
    // bracketing that work, so the message tracks the download.
    statusCallback?.('Fetching features')
    const features = await dataAdapter.getFeaturesArray(region, {
      stopToken,
      statusCallback,
    })
    return buildScoreResult(features, scoreColumn)
  }
}

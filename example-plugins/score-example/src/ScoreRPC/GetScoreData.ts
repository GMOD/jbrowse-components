// #exampleFile shared | worker: fetch features from the adapter, then encode
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  encodeFeatures,
  encodedChannelTransferables,
} from '@jbrowse/core/util/markEncoding'

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
      // wrapped in rpcResult so postMessage transfers its buffers
      transferables: true
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
    // The encoder is the packer: one walk reads `scoreColumn` as `y`, skips a
    // feature with no finite score, and ships the dense arrays with their
    // extremes and a hit index. A packer of your own is for a payload the
    // encoder's channels cannot say.
    const encoded = encodeFeatures(
      features,
      { y: scoreColumn },
      { jexl: this.pluginManager.jexl },
    )
    return rpcResult(encoded, encodedChannelTransferables(encoded))
  }
}

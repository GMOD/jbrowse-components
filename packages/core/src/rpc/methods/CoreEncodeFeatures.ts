import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'
import SerializableFilterChain from '../../pluggableElementTypes/renderers/util/serializableFilterChain.ts'
import { rpcResult } from '../../util/librpc.ts'
import {
  encodeFeatures,
  encodedChannelTransferables,
} from '../../util/markEncoding.ts'
import { createProgressReporter, updateStatus } from '../../util/progress.ts'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '../../util/stopToken.ts'
import { measureRegionBytes } from '../byteBudget.ts'

import type { EncodedChannels, MarkEncoding } from '../../util/markEncoding.ts'
import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * One region's features through each of the request's encodings. `layers[i]`
 * is `encodings[i]`'s channels, so a display's mark list indexes straight
 * into it.
 */
export interface EncodedFeaturesResult {
  layers: EncodedChannels[]
  bytes?: number
}

export type CoreEncodeFeaturesArgs = {
  adapterConfig: Record<string, unknown>
  region: { refName: string; start: number; end: number; assemblyName: string }
  encodings: MarkEncoding[]
  /** `jexl:`-prefixed feature filters, every one of which must pass. */
  filters?: string[]
  byteLimit?: number
  sequenceAdapter?: Record<string, unknown>
}

/**
 * Fetch a region's features once and evaluate every declared encoding over
 * them in the worker, where the `Feature` objects are. The colours come back
 * packed, the scale tables resolved, and the main thread reads the same table
 * for its legend that the colours were drawn from.
 */
export default class CoreEncodeFeatures extends RpcMethodTypeWithRenameRegion<'CoreEncodeFeatures'> {
  name = 'CoreEncodeFeatures' as const

  async execute(args: RpcExecuteArgs<'CoreEncodeFeatures'>) {
    const {
      sessionId,
      adapterConfig,
      sequenceAdapter,
      region,
      encodings,
      filters = [],
      byteLimit,
      stopToken,
      statusCallback,
    } = args
    const { pluginManager } = this
    const stopTokenCheck = createStopTokenChecker(stopToken)
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    })

    const { bytes, tooLarge } = await measureRegionBytes({
      dataAdapter,
      regions: [region],
      byteLimit,
      stopToken,
      statusCallback,
      stopTokenCheck,
    })
    if (tooLarge) {
      return tooLarge
    }

    const fetched = await updateStatus(
      'Downloading features',
      statusCallback,
      () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
    )
    checkStopTokenThrottled(stopTokenCheck)

    const chain = new SerializableFilterChain({
      filters,
      jexl: pluginManager.jexl,
    })
    const features =
      chain.filterChain.length === 0
        ? fetched
        : fetched.filter(f => chain.passes(f))

    const layers = encodings.map(encoding =>
      encodeFeatures(features, encoding, {
        jexl: pluginManager.jexl,
        report: createProgressReporter({
          label: 'Encoding features',
          total: features.length,
          statusCallback,
          stopTokenCheck,
        }),
      }),
    )
    const result: EncodedFeaturesResult = { layers, bytes }
    return rpcResult(
      result,
      layers.flatMap(l => encodedChannelTransferables(l)),
    )
  }
}

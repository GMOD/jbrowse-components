import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'
import { rpcResult } from '../../util/librpc.ts'
import {
  encodeFeatures,
  encodedChannelTransferables,
} from '../../util/markEncoding.ts'
import { createProgressReporter } from '../../util/progress.ts'
import { measureRegionBytes } from '../byteBudget.ts'
import { layerFeatures } from './layerFeatures.ts'

import type { EncodedLayersResult } from '../../util/markEncoding.ts'
import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * Fetch a region's features once, run the shared transform steps over them,
 * split them by the facet where the request names one, run each layer's own
 * steps (per section, under a facet), and evaluate the layer's encoding over
 * what is left in the worker, where the `Feature` objects are, filling the
 * lanes its mark reads. The colours come back packed, the scale tables
 * resolved, and the main thread reads the same table for its legend that the
 * colours were drawn from.
 */
export default class CoreGetEncodedLayers extends RpcMethodTypeWithRenameRegion<'CoreGetEncodedLayers'> {
  name = 'CoreGetEncodedLayers' as const

  async execute(args: RpcExecuteArgs<'CoreGetEncodedLayers'>) {
    const {
      region,
      layers: requested,
      byteLimit,
      signal,
      statusCallback,
    } = args
    const { pluginManager } = this
    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager,
    })

    const { bytes, tooLarge } = await measureRegionBytes({
      dataAdapter,
      regions: [region],
      byteLimit,
      signal,
      statusCallback,
    })
    if (tooLarge) {
      return tooLarge
    }

    const { jexl } = pluginManager
    const {
      layers: layered,
      sections,
      zoomRange,
    } = await layerFeatures(dataAdapter, args, jexl)
    const layers = requested.map((request, i) => {
      const { features, row } = layered[i]!
      return encodeFeatures(
        features,
        { ...request.encoding, row },
        request.lanes,
        {
          jexl,
          report: createProgressReporter({
            label: 'Processing features',
            total: features.length,
            statusCallback,
            signal,
          }),
        },
      )
    })
    const result: EncodedLayersResult = {
      layers,
      facet: sections,
      bytes,
      zoomRange,
    }
    return rpcResult(
      result,
      layers.flatMap(l => encodedChannelTransferables(l)),
    )
  }
}

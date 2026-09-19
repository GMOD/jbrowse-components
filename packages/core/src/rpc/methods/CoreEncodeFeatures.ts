import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'
import { checkAbortSignal } from '../../util/aborting.ts'
import {
  FACET_ROW,
  facetLayers,
  runTransforms,
} from '../../util/featureTransforms.ts'
import { rpcResult } from '../../util/librpc.ts'
import {
  encodeFeatures,
  encodedChannelTransferables,
} from '../../util/markEncoding.ts'
import { createProgressReporter, updateStatus } from '../../util/progress.ts'
import { measureRegionBytes } from '../byteBudget.ts'

import type { EncodedFeaturesResult } from '../../util/markEncoding.ts'
import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * Fetch a region's features once, run the shared transform steps over them,
 * split them by the facet where the request names one, run each layer's own
 * steps (per section, under a facet), and evaluate the layer's encoding over
 * what is left in the worker, where the `Feature` objects are, filling the
 * lanes its shape reads. The colours come back packed, the scale tables
 * resolved, and the main thread reads the same table for its legend that the
 * colours were drawn from.
 */
export default class CoreEncodeFeatures extends RpcMethodTypeWithRenameRegion<'CoreEncodeFeatures'> {
  name = 'CoreEncodeFeatures' as const

  async execute(args: RpcExecuteArgs<'CoreEncodeFeatures'>) {
    const {
      sessionId,
      adapterConfig,
      sequenceAdapter,
      region,
      layers: requested,
      transform = [],
      facet,
      bpPerPx,
      byteLimit,
      signal,
      statusCallback,
    } = args
    const { pluginManager } = this
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
      signal,
      statusCallback,
    })
    if (tooLarge) {
      return tooLarge
    }

    const fetchOpts = { bpPerPx, statusCallback, signal }
    const [fetched, zoomRange] = await updateStatus(
      'Downloading features',
      statusCallback,
      () =>
        Promise.all([
          dataAdapter.getFeaturesArray(region, fetchOpts),
          dataAdapter.getZoomRange(fetchOpts),
        ]),
    )
    checkAbortSignal(signal)

    const { jexl } = pluginManager
    const shared = runTransforms(fetched, transform, jexl)

    const faceted = facet
      ? facetLayers(
          shared,
          facet.field,
          requested.map(r => ({ transform: r.transform, row: r.encoding.row })),
          jexl,
        )
      : undefined
    const layers = requested.map(({ encoding, lanes, transform: own }, i) => {
      const features = faceted
        ? faceted.layers[i]!
        : own
          ? runTransforms(shared, own, jexl)
          : shared
      return encodeFeatures(
        features,
        faceted ? { ...encoding, row: FACET_ROW } : encoding,
        lanes,
        {
          jexl,
          report: createProgressReporter({
            label: 'Encoding features',
            total: features.length,
            statusCallback,
            signal,
          }),
        },
      )
    })
    const result: EncodedFeaturesResult = {
      layers,
      facet: faceted?.sections,
      bytes,
      zoomRange,
    }
    return rpcResult(
      result,
      layers.flatMap(l => encodedChannelTransferables(l)),
    )
  }
}

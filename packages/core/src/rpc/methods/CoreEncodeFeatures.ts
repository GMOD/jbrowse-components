import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'
import { checkAbortSignal } from '../../util/aborting.ts'
import {
  DEFAULT_STACK_AS,
  facetRows,
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
 * then each layer's own, stack the facet groups a layer declares (the facet's
 * row is the layer's `row` where it names none), and evaluate the layer's
 * encoding over what is left
 * in the worker, where the `Feature` objects are, filling the lanes its shape
 * reads. The colours come back packed, the scale tables resolved, and the
 * main thread reads the same table for its legend that the colours were
 * drawn from.
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
      filters = [],
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
    const shared = runTransforms(
      fetched,
      [
        ...filters.map(expr => ({ type: 'filter' as const, expr })),
        ...transform,
      ],
      jexl,
    )

    const layers = requested.map(
      ({ encoding, lanes, transform: own, facet }) => {
        const stepped = own ? runTransforms(shared, own, jexl) : shared
        const faceted = facet ? facetRows(stepped, facet, jexl) : undefined
        const features = faceted?.features ?? stepped
        const rowed =
          facet && encoding.row === undefined
            ? { ...encoding, row: facet.as ?? DEFAULT_STACK_AS }
            : encoding
        return {
          ...encodeFeatures(features, rowed, lanes, {
            jexl,
            report: createProgressReporter({
              label: 'Encoding features',
              total: features.length,
              statusCallback,
              signal,
            }),
          }),
          facet: faceted?.sections,
        }
      },
    )
    const result: EncodedFeaturesResult = { layers, bytes, zoomRange }
    return rpcResult(
      result,
      layers.flatMap(l => encodedChannelTransferables(l)),
    )
  }
}

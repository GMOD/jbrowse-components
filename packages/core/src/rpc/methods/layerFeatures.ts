import { checkAbortSignal } from '../../util/aborting.ts'
import { facetLayers, runTransforms } from '../../util/featureTransforms.ts'
import { updateStatus } from '../../util/progress.ts'

import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { JexlInstance } from '../../util/jexlStrings.ts'
import type {
  CoreGetEncodedLayersArgs,
  FieldRef,
} from '../../util/markEncodingTypes.ts'
import type { StatusCallback } from '../../util/progress.ts'
import type { Feature } from '../../util/simpleFeature.ts'

/**
 * One layer of a request as the encoder takes it: its features, and the row
 * each stands in — the field the layer reads, or under a facet each feature's
 * stacked row.
 */
export interface LayerFeatures {
  features: readonly Feature[]
  row: FieldRef | readonly number[] | undefined
}

/**
 * The feature list each layer of a `CoreGetEncodedLayers` request encodes: the
 * region's features through the shared steps, split by the facet where the
 * request names one, then through each layer's own steps, with each faceted
 * layer's stacked rows beside it. An instance's `featureIndex` indexes its
 * layer's list, so the same request answers which feature an instance is.
 */
export async function layerFeatures(
  dataAdapter: BaseFeatureDataAdapter,
  args: Pick<
    CoreGetEncodedLayersArgs,
    'region' | 'layers' | 'transform' | 'facet' | 'bpPerPx' | 'opts'
  > & { signal?: AbortSignal; statusCallback?: StatusCallback },
  jexl: JexlInstance,
) {
  const {
    region,
    layers: requested,
    transform = [],
    facet,
    bpPerPx,
    opts,
    signal,
    statusCallback,
  } = args
  const fetchOpts = { ...opts, bpPerPx, statusCallback, signal }
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

  const shared = runTransforms(fetched, transform, jexl)
  const rowFields = requested.map(r => r.encoding.row)
  const faceted = facet
    ? facetLayers(
        shared,
        facet,
        requested.map((r, i) => ({
          transform: r.transform,
          row: rowFields[i],
        })),
        jexl,
      )
    : undefined
  const layers = requested.map(({ transform: own }, i): LayerFeatures => {
    const split = faceted?.layers[i]
    return split
      ? { features: split.features, row: split.rows }
      : {
          features: own ? runTransforms(shared, own, jexl) : shared,
          row: rowFields[i],
        }
  })
  return { layers, sections: faceted?.sections, zoomRange }
}

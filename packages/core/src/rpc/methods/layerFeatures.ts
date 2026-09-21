import { checkAbortSignal } from '../../util/aborting.ts'
import { facetLayers, runTransforms } from '../../util/featureTransforms.ts'
import { updateStatus } from '../../util/progress.ts'

import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { JexlInstance } from '../../util/jexlStrings.ts'
import type {
  CoreEncodeFeaturesArgs,
  FacetSection,
} from '../../util/markEncodingTypes.ts'
import type { StatusCallback } from '../../util/progress.ts'
import type { Feature } from '../../util/simpleFeature.ts'

/**
 * The feature list each layer of a `CoreEncodeFeatures` request encodes: the
 * region's features through the shared steps, split by the facet where the
 * request names one, then through each layer's own steps, with each faceted
 * layer's stacked rows beside it. An instance's `featureIndex` indexes its
 * layer's list, so the same request answers which feature an instance is.
 */
export async function layerFeatures(
  dataAdapter: BaseFeatureDataAdapter,
  args: Pick<
    CoreEncodeFeaturesArgs,
    'region' | 'layers' | 'transform' | 'facet' | 'bpPerPx'
  > & { signal?: AbortSignal; statusCallback?: StatusCallback },
  jexl: JexlInstance,
) {
  const {
    region,
    layers: requested,
    transform = [],
    facet,
    bpPerPx,
    signal,
    statusCallback,
  } = args
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

  const shared = runTransforms(fetched, transform, jexl)
  const faceted = facet
    ? facetLayers(
        shared,
        facet.field,
        requested.map(r => ({ transform: r.transform, row: r.encoding.row })),
        jexl,
      )
    : undefined
  const layers: (readonly Feature[])[] = requested.map(
    ({ transform: own }, i) =>
      faceted
        ? faceted.layers[i]!.features
        : own
          ? runTransforms(shared, own, jexl)
          : shared,
  )
  const rows = faceted?.layers.map(l => l.rows)
  const sections: FacetSection[] | undefined = faceted?.sections
  return { layers, rows, sections, zoomRange }
}

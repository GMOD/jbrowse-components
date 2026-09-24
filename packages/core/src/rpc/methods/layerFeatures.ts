import { checkAbortSignal } from '../../util/aborting.ts'
import {
  DEFAULT_PILEUP_AS,
  facetLayers,
  runTransforms,
} from '../../util/featureTransforms.ts'
import { updateStatus } from '../../util/progress.ts'

import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { JexlInstance } from '../../util/jexlStrings.ts'
import type {
  CoreEncodeFeaturesArgs,
  FieldRef,
  LayerRequest,
  TransformStep,
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
 * The field the last `pileup` of a step list wrote, unless an `aggregate` or
 * `coverage` after it made its features from nothing and left no row on them.
 */
function survivingPileupField(steps: readonly TransformStep[]) {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]!
    if (step.type === 'pileup') {
      return step.as ?? DEFAULT_PILEUP_AS
    }
    if (step.type === 'aggregate' || step.type === 'coverage') {
      return undefined
    }
  }
  return undefined
}

/**
 * The field a layer's `row` channel reads: the one its encoding names, else
 * the one the last pileup before its encode wrote — the layer's own, the
 * facet's per-section one, or the request's shared one — so a packed layer
 * restates nothing. Resolved once here for the facet split and the encoder
 * alike, so a facet stacks the rows the unfaceted encoder reads.
 */
function layerRow(
  { encoding, transform = [] }: LayerRequest,
  shared: readonly TransformStep[],
  section: readonly TransformStep[],
) {
  return (
    encoding.row ?? survivingPileupField([...shared, ...section, ...transform])
  )
}

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
  const rowFields = requested.map(r =>
    layerRow(r, transform, facet?.transform ?? []),
  )
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

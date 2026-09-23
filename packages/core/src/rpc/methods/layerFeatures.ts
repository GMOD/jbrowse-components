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
  PileupStep,
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

function pileupField(transform: readonly TransformStep[] = []) {
  const pileup = transform.findLast((s): s is PileupStep => s.type === 'pileup')
  return pileup === undefined ? undefined : (pileup.as ?? DEFAULT_PILEUP_AS)
}

/**
 * The field a layer's `row` channel reads: the one its encoding names, else the
 * one its own `pileup` writes, else the one the request's shared `pileup`
 * writes, so a packed layer restates nothing. Resolved once here for the facet
 * split and the encoder alike, so a facet stacks the rows the unfaceted
 * encoder reads.
 */
export function layerRow(
  { encoding, transform }: LayerRequest,
  shared?: readonly TransformStep[],
) {
  return encoding.row ?? pileupField(transform) ?? pileupField(shared)
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
  const rowFields = requested.map(r => layerRow(r, transform))
  const faceted = facet
    ? facetLayers(
        shared,
        facet.field,
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

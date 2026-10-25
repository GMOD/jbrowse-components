import { checkAbortSignal } from '../../util/aborting.ts'
import { layerTables, unreadStepFields } from '../../util/featureTransforms.ts'
import { pathSeries } from '../../util/pathSeries.ts'
import { updateStatus } from '../../util/progress.ts'

import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { FeatureTable } from '../../util/featureTable.ts'
import type { JexlInstance } from '../../util/jexlStrings.ts'
import type {
  CoreGetEncodedLayersArgs,
  FieldRef,
} from '../../util/markEncodingTypes.ts'
import type { StatusCallback } from '../../util/progress.ts'

/**
 * One layer of a request as the encoder takes it: its rows, and the row of the
 * plot each stands in — the field the layer reads, or under a facet each
 * row's stacked row.
 */
export interface LayerFeatures {
  table: FeatureTable
  row: FieldRef | ArrayLike<number> | undefined
  /** Each row's series, for a layer whose request names a path. */
  series?: Uint32Array
  /** The stretch a path breaks across, for a layer whose request names a path. */
  gapBp?: number
}

/**
 * The table each layer of a `CoreGetEncodedLayers` request encodes: the
 * region's features through the shared steps, split by the facet where the
 * request names one, then through each layer's own steps, with each faceted
 * layer's stacked rows beside it, and a path layer's rows in series order.
 * An instance's `featureIndex` indexes its layer's table, so the same request
 * answers which row an instance is, and its `root` indexes `fetched`.
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
  const notices: string[] = []
  const facts: Record<string, unknown> = {}
  const fetchOpts = {
    ...opts,
    bpPerPx,
    statusCallback,
    signal,
    notices,
    facts,
  }
  const [fetched, zoomRange] = await updateStatus(
    'Downloading features',
    statusCallback,
    () =>
      Promise.all([
        dataAdapter.getFeatureTable(region, fetchOpts),
        dataAdapter.getZoomRange(fetchOpts),
      ]),
  )
  checkAbortSignal(signal)

  const tables = layerTables(
    fetched,
    {
      transform,
      facet,
      layers: requested.map(r => ({
        transform: r.transform,
        row: r.encoding.row,
      })),
    },
    jexl,
  )
  const unreadFilterFields =
    fetched.length === 0
      ? undefined
      : tables.layers.some(l => l.table.length > 0)
        ? []
        : unreadStepFields(fetched, transform, jexl)
  const layers = tables.layers.map((layer, i): LayerFeatures => {
    const { path, transform: own = [] } = requested[i]!
    return path
      ? pathSeries(
          layer.table,
          layer.row,
          path,
          [...transform, ...(facet?.transform ?? []), ...own],
          jexl,
        )
      : layer
  })
  return {
    fetched,
    layers,
    sections: tables.sections,
    zoomRange,
    notices,
    facts,
    unreadFilterFields,
  }
}

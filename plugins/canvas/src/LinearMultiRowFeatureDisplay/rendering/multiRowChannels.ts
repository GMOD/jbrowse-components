import { drawnFeatureContext, forEachDrawnFeature } from './featurePainting.ts'

import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
} from './multiRowRenderingBackendTypes.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/**
 * One region's features as `span` channels, one rect per drawn feature. `count`
 * is what was actually written, not the one-per-feature capacity — a hidden
 * category or a filtered row leaves the tail unwritten.
 */
export function buildMultiRowChannels(
  data: MultiRowRegionData,
  state: MultiRowFeaturePaintInputs,
): SpanChannels {
  const { featureStarts, featureEnds } = data
  const n = featureStarts.length
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const row = new Uint32Array(n)
  const color = new Uint32Array(n)
  let count = 0
  forEachDrawnFeature(
    data,
    drawnFeatureContext(data, state),
    (i, rowIndex, abgr) => {
      x[count] = featureStarts[i]!
      x2[count] = featureEnds[i]!
      row[count] = rowIndex
      color[count] = abgr
      count++
    },
  )
  return { x, x2, row, color, count }
}

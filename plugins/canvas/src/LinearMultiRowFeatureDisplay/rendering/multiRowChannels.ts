import { drawnFeatureContext, forEachDrawnFeature } from './featurePainting.ts'

import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
} from './multiRowRenderingBackendTypes.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/**
 * Encode one region's features into the `span` shape's channels — one rect per
 * drawn feature, `[startBp, endBp)` on its row in its colour.
 *
 * Runs on the main thread (the per-region encode autorun) rather than in the
 * worker, which is what lets a row reorder, a row recolor, or a legend category
 * being toggled off re-encode with no RPC roundtrip: all three are inputs to
 * `forEachDrawnFeature`, which decides both which features appear here and what
 * colour they carry.
 *
 * `count` is what was actually written — a hidden legend category or a filtered
 * row means fewer instances than features — and both the GPU packer and the
 * painter read it, so neither can draw the trailing capacity.
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

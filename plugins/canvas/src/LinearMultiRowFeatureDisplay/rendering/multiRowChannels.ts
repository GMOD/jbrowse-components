import { drawnFeatureContext, forEachDrawnFeature } from './featurePainting.ts'

import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
} from './multiRowRenderingBackendTypes.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/**
 * One region's features as `span` channels, one rect per drawn feature, plus
 * what the hit test needs to answer a channel index back to the data. `count`
 * is what was actually written, not the one-per-feature capacity — a hidden
 * category or a filtered row leaves the tail unwritten, so `featureIndex[c]`
 * names the feature channel `c` came from. `rowIndices[rowStart[r] ..
 * rowStart[r + 1])` are the channel indices drawn on row `r`, in paint order;
 * a row past `rowStart.length - 1` has no bucket.
 */
export interface MultiRowEncoded extends SpanChannels {
  featureIndex: Uint32Array
  rowStart: Int32Array
  rowIndices: Int32Array
}

/**
 * Encode one region on the main thread, so a row reorder, recolor or category
 * toggle re-encodes with no RPC roundtrip. The buckets come out of the same
 * walk, so the hit test cannot answer "is this feature drawn" differently from
 * the paint that put it there.
 */
export function buildMultiRowChannels(
  data: MultiRowRegionData,
  state: MultiRowFeaturePaintInputs,
): MultiRowEncoded {
  const { featureStarts, featureEnds } = data
  const n = featureStarts.length
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const row = new Uint32Array(n)
  const color = new Uint32Array(n)
  const featureIndex = new Uint32Array(n)
  let count = 0
  let rowCount = 0
  forEachDrawnFeature(
    data,
    drawnFeatureContext(data, state),
    (i, rowIndex, abgr) => {
      x[count] = featureStarts[i]!
      x2[count] = featureEnds[i]!
      row[count] = rowIndex
      color[count] = abgr
      featureIndex[count] = i
      count++
      if (rowIndex >= rowCount) {
        rowCount = rowIndex + 1
      }
    },
  )
  const rowStart = new Int32Array(rowCount + 1)
  for (let c = 0; c < count; c++) {
    rowStart[row[c]! + 1]!++
  }
  for (let r = 0; r < rowCount; r++) {
    rowStart[r + 1]! += rowStart[r]!
  }
  const cursor = Int32Array.from(rowStart.subarray(0, rowCount))
  const rowIndices = new Int32Array(count)
  for (let c = 0; c < count; c++) {
    rowIndices[cursor[row[c]!]!++] = c
  }
  return { x, x2, row, color, count, featureIndex, rowStart, rowIndices }
}

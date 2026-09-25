import { hiddenByCategory, ownColors } from './featurePainting.ts'

import type {
  MultiRowEncodeInputs,
  MultiRowRegionData,
} from './multiRowRenderingBackendTypes.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/**
 * One region's features as `span` channels, one rect per feature the legend
 * has not hidden, its `row` the feature's row KEY, plus what the hit test
 * needs to answer a channel index back to the data. `count` is what was
 * actually written, not the one-per-feature capacity — a hidden category
 * leaves the tail unwritten, so `featureIndex[c]` names the feature channel
 * `c` came from. `rowIndices[rowStart[k] .. rowStart[k + 1])` are the channel
 * indices carrying key `k`, in paint order; a key past `rowStart.length - 1`
 * has no bucket.
 */
export interface MultiRowEncoded extends SpanChannels {
  featureIndex: Uint32Array
  rowStart: Int32Array
  rowIndices: Int32Array
}

/**
 * Encode one region on the main thread, once: the row table carries the
 * reader's order, focus and colours, so only a category toggle re-encodes.
 * The buckets come out of the same walk, so the hit test cannot answer "is
 * this feature drawn" differently from the paint that put it there.
 */
export function buildMultiRowChannels(
  data: MultiRowRegionData,
  { rowKeys, overriddenRows, hiddenColors, fieldPalette }: MultiRowEncodeInputs,
): MultiRowEncoded {
  const { featureStarts, featureEnds, featurePartitionIndex } = data
  const featureColors = ownColors(data, fieldPalette)
  const keyForLocal = Uint32Array.from(data.partitionValues, v =>
    rowKeys.keyOf(v),
  )
  const overriddenLocal = data.partitionValues.map(v => overriddenRows.has(v))
  const n = featureStarts.length
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const row = new Uint32Array(n)
  const color = new Uint32Array(n)
  const featureIndex = new Uint32Array(n)
  let count = 0
  let keyCount = 0
  for (let i = 0; i < n; i++) {
    const local = featurePartitionIndex[i]!
    const abgr = featureColors[i]!
    if (hiddenByCategory(abgr, overriddenLocal[local]!, hiddenColors)) {
      continue
    }
    const key = keyForLocal[local]!
    x[count] = featureStarts[i]!
    x2[count] = featureEnds[i]!
    row[count] = key
    color[count] = abgr
    featureIndex[count] = i
    count++
    if (key >= keyCount) {
      keyCount = key + 1
    }
  }
  const rowStart = new Int32Array(keyCount + 1)
  for (let c = 0; c < count; c++) {
    rowStart[row[c]! + 1]!++
  }
  for (let k = 0; k < keyCount; k++) {
    rowStart[k + 1]! += rowStart[k]!
  }
  const cursor = Int32Array.from(rowStart.subarray(0, keyCount))
  const rowIndices = new Int32Array(count)
  for (let c = 0; c < count; c++) {
    rowIndices[cursor[row[c]!]!++] = c
  }
  return { x, x2, row, color, count, featureIndex, rowStart, rowIndices }
}

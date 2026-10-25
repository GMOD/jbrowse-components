import { rowSpanIndex } from '@jbrowse/render-core/marks'

import { ownColors } from './featurePainting.ts'

import type {
  MultiRowEncodeInputs,
  MultiRowRegionData,
} from './multiRowRenderingBackendTypes.ts'
import type { RowSpanIndex, SpanChannels } from '@jbrowse/render-core/marks'

/**
 * One region's features as `span` channels, one rect per feature the legend
 * has not hidden, its `row` the feature's row KEY, plus what the hit test
 * needs to answer a channel index back to the data. `count` is what was
 * actually written, not the one-per-feature capacity — a hidden category
 * leaves the tail unwritten, so `featureIndex[c]` names the feature channel
 * `c` came from. `rowIndex` finds a key's channels over a stretch of bp.
 * `introns` spans the gap between two consecutive entries of one feature,
 * drawn as the line joining its blocks.
 */
export interface MultiRowEncoded extends SpanChannels {
  color: Uint32Array
  featureIndex: Uint32Array
  rowIndex: RowSpanIndex
  introns: SpanChannels
}

/**
 * Encode one region on the main thread, once: the row table carries the
 * reader's order, focus and colors, so only a category toggle re-encodes.
 * The row index is over the channels written, so the hit test cannot answer
 * "is this feature drawn" differently from the paint that put it there.
 */
export function buildMultiRowChannels(
  data: Pick<
    MultiRowRegionData,
    | 'featureStarts'
    | 'featureEnds'
    | 'featureIds'
    | 'featureColors'
    | 'rectColorValues'
    | 'colorValues'
    | 'rowValues'
    | 'featureRowValueIndex'
  >,
  { rowKeys, hiddenColors, fieldPalette }: MultiRowEncodeInputs,
): MultiRowEncoded {
  const { featureStarts, featureEnds, featureIds, featureRowValueIndex } = data
  const featureColors = ownColors(data, fieldPalette)
  const keyForLocal = Uint32Array.from(data.rowValues, v => rowKeys.keyOf(v))
  const n = featureStarts.length
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const row = new Uint32Array(n)
  const color = new Uint32Array(n)
  const featureIndex = new Uint32Array(n)
  const introns = {
    x: new Uint32Array(n),
    x2: new Uint32Array(n),
    row: new Uint32Array(n),
    color: new Uint32Array(n),
    count: 0,
  }
  let count = 0
  for (let i = 0; i < n; i++) {
    const local = featureRowValueIndex[i]!
    const abgr = featureColors[i]!
    if (hiddenColors.has(abgr)) {
      continue
    }
    const key = keyForLocal[local]!
    x[count] = featureStarts[i]!
    x2[count] = featureEnds[i]!
    row[count] = key
    color[count] = abgr
    featureIndex[count] = i
    count++
    if (i > 0 && featureIds[i - 1] === featureIds[i]) {
      const c = introns.count++
      introns.x[c] = featureEnds[i - 1]!
      introns.x2[c] = featureStarts[i]!
      introns.row[c] = key
      introns.color[c] = abgr
    }
  }
  return {
    x,
    x2,
    row,
    color,
    count,
    featureIndex,
    rowIndex: rowSpanIndex(x, x2, row, count),
    introns,
  }
}

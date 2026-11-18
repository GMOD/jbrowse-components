import { predecessorReach, rowSpanIndex } from '@jbrowse/render-core/marks'

import type { StoredLayer } from './markList.ts'
import type { RowSpanIndex } from '@jbrowse/render-core/marks'

const rowIndexes = new WeakMap<StoredLayer, RowSpanIndex>()

/** A layer's instances indexed by the row they stand in, built once per layer. */
export function rowSpanIndexOf(layer: StoredLayer) {
  let index = rowIndexes.get(layer)
  if (!index) {
    index = rowSpanIndex(layer.x, layer.x2, layer.row, layer.count)
    rowIndexes.set(layer, index)
  }
  return index
}

const predecessorReaches = new WeakMap<StoredLayer, Uint32Array>()

/**
 * How far back a linear path's segments reach from each position of the
 * layer's row index, built once per layer, the first time a linear line asks.
 */
export function predecessorReachOf(layer: StoredLayer) {
  let back = predecessorReaches.get(layer)
  if (!back) {
    back = predecessorReach(rowSpanIndexOf(layer), layer.x, layer.x2, layer.row)
    predecessorReaches.set(layer, back)
  }
  return back
}

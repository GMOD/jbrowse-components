import { rowSpanIndex } from '@jbrowse/render-core/marks'

import type { StoredLayer } from './markList.ts'
import type { RowSpanIndex } from '@jbrowse/render-core/marks'

const rowIndexes = new WeakMap<StoredLayer, RowSpanIndex>()

/** A layer's instances indexed by the row they stand in, built once per layer. */
export function rowIndexOf(layer: StoredLayer) {
  let index = rowIndexes.get(layer)
  if (!index) {
    index = rowSpanIndex(layer.x, layer.x2, layer.row, layer.count)
    rowIndexes.set(layer, index)
  }
  return index
}

import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { MarkRegionData } from './markList.ts'

/** Which marks paint in their rows' colors, and each row's color by name. */
export interface RowPaint {
  marks: readonly boolean[]
  colors: ReadonlyMap<string, string>
}

/**
 * The region with each instance of a mark `paint` names taking its row's
 * color, the layer's own constant where the row has none. A keyed region
 * only: its `row` lane holds the keys `names` spells.
 */
export function withRowColors(
  region: MarkRegionData,
  paint: RowPaint,
  names: readonly string[],
): MarkRegionData {
  const abgrOfKey = new Map<number, number | undefined>()
  const abgrOf = (key: number) => {
    if (!abgrOfKey.has(key)) {
      const css = paint.colors.get(names[key] ?? '')
      abgrOfKey.set(key, css === undefined ? undefined : cssColorToABGR(css))
    }
    return abgrOfKey.get(key)
  }
  const layers = region.layers.map((layer, i) => {
    const { row, color } = layer
    if (!paint.marks[i] || !row || typeof color !== 'number') {
      return layer
    }
    const painted = new Uint32Array(layer.count)
    for (let k = 0; k < layer.count; k++) {
      painted[k] = abgrOf(row[k]!) ?? color
    }
    return { ...layer, color: painted }
  })
  return layers.every((layer, i) => layer === region.layers[i])
    ? region
    : { ...region, layers }
}

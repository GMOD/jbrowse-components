import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { MarkRegionData } from './markList.ts'

/**
 * Which marks paint in their rows' colors, each row's color by name, and the
 * field the rows split on, whose categorical color takes them too.
 */
export interface RowColors {
  marks: readonly boolean[]
  colors: ReadonlyMap<string, string>
  field: string
}

/**
 * The region with each instance of a mark `rowColors` lists taking its row's
 * color where the row has one. A mark naming no color keeps its constant on
 * the rows with none. A categorical color over the rows' field keeps what its
 * scale dealt them, and its key entries take the row colors too, so a written
 * `range` colors only the rows with none and no palette slot moves (ADR-251).
 * A keyed region only: its `row` lane holds the keys `names` spells.
 */
export function withRowColors(
  region: MarkRegionData,
  rowColors: RowColors,
  names: readonly string[],
): MarkRegionData {
  const abgrOfName = new Map<string, number | undefined>()
  const abgrOf = (name: string) => {
    if (!abgrOfName.has(name)) {
      const css = rowColors.colors.get(name)
      abgrOfName.set(name, css === undefined ? undefined : cssColorToABGR(css))
    }
    return abgrOfName.get(name)
  }
  const layers = region.layers.map((layer, i) => {
    const { row, color, scale } = layer
    if (!rowColors.marks[i] || !row) {
      return layer
    }
    if (typeof color === 'number') {
      const painted = new Uint32Array(layer.count)
      for (let k = 0; k < layer.count; k++) {
        painted[k] = abgrOf(names[row[k]!] ?? '') ?? color
      }
      return { ...layer, color: painted }
    }
    if (
      color instanceof Uint32Array &&
      scale?.kind === 'categorical' &&
      scale.field === rowColors.field
    ) {
      const painted = new Uint32Array(layer.count)
      for (let k = 0; k < layer.count; k++) {
        painted[k] = abgrOf(names[row[k]!] ?? '') ?? color[k]!
      }
      return {
        ...layer,
        color: painted,
        scale: {
          ...scale,
          entries: scale.entries.map(e => ({
            ...e,
            color: abgrOf(e.value) ?? e.color,
          })),
        },
      }
    }
    return layer
  })
  return layers.every((layer, i) => layer === region.layers[i])
    ? region
    : { ...region, layers }
}

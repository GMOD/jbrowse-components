import { dealKeyColors } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { CategoricalField } from '@jbrowse/core/util/categoricalField'
import type { LegendCandidateSource } from '@jbrowse/core/util/legendCandidates'

/**
 * What a worker ships for a color field: each distinct value's text, and each
 * value painted with the row it was painted on.
 */
export interface FieldColorValues {
  field: string
  values: string[]
  painted: { rowIndex: number; valueIndex: number }[]
}

/**
 * The `derivedColorScale` source for a region's color field values, each
 * painted through `field`: every value dealt a color before any is read, so a
 * scale dealing on first sight deals in one order, and a region whose values
 * name another field offers nothing. `rowPaints` says whether a row's paint
 * reached the screen, which a hidden section or a row-colored row did not.
 */
export function fieldColorCandidates<
  T extends { colorValues?: FieldColorValues },
>(field: CategoricalField, rowPaints: (data: T, rowIndex: number) => boolean) {
  const packed = new Map<string, number>()
  const colorOf = (key: string) => {
    let color = packed.get(key)
    if (color === undefined) {
      color = cssColorToABGR(field.color(key))
      packed.set(key, color)
    }
    return color
  }
  return (data: T): LegendCandidateSource => {
    const { colorValues } = data
    if (colorValues?.field !== field.field) {
      return { candidates: [], rowPaintsCandidateColor: () => false }
    }
    dealKeyColors(field, colorValues.values.map(field.key))
    return {
      candidates: colorValues.painted.map(({ rowIndex, valueIndex }) => {
        const value = field.key(colorValues.values[valueIndex])
        return { rowIndex, value, color: colorOf(value) }
      }),
      rowPaintsCandidateColor: rowIndex => rowPaints(data, rowIndex),
    }
  }
}

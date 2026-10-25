import { compareGroupKeys } from '@jbrowse/core/util/groupKeys'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import { readsValue } from './markSpecs.ts'

import type { ColorSource } from './markColor.ts'
import type { MarkType } from './markVocabulary.ts'
import type { ColorScaleTable } from '@jbrowse/core/util/markEncoding'

/**
 * What clustering and "Sort rows by ... here" compare a row's instances on:
 * the value a bar or point stands at (`y`), else a span's color, as the
 * category key it paints (`colorKey`), the number it ramps (`colorValue`), or
 * where it covers alone (`presence`) under a constant.
 */
export type RowCompareBy = 'y' | 'colorKey' | 'colorValue' | 'presence'

export interface RowCompare {
  mark: number
  by: RowCompareBy
}

function spanCompare(color: ColorSource | undefined): RowCompareBy {
  switch (color?.kind) {
    case 'categories':
    case 'identity':
      return 'colorKey'
    case 'numbers':
      return 'colorValue'
    default:
      return 'presence'
  }
}

/**
 * The first drawing mark standing at a value, else the drawing span on top,
 * and what its rows compare on; undefined where neither draws. A spliced
 * feature's blocks draw over the line joining them, so its rows compare on
 * the blocks.
 */
export function rowCompareOf(
  drawing: readonly number[],
  markTypes: readonly MarkType[],
  colors: readonly ColorSource[],
): RowCompare | undefined {
  const valued = drawing.find(i => readsValue(markTypes[i]!))
  if (valued !== undefined) {
    return { mark: valued, by: 'y' }
  }
  const span = drawing.findLast(i => markTypes[i] === 'rect')
  return span === undefined
    ? undefined
    : { mark: span, by: spanCompare(colors[span]) }
}

/** What a sort or a caption names the compared thing. */
export function rowCompareLabel(
  by: RowCompareBy,
  color: ColorSource | undefined,
) {
  return by === 'y'
    ? 'value'
    : by === 'presence'
      ? 'presence'
      : color?.kind === 'categories' || color?.kind === 'numbers'
        ? isJexl(color.encoding.field)
          ? 'expression'
          : color.encoding.field
        : 'color'
}

/**
 * The categories a layer's table paints each color for, so a sort reads a
 * span's category and not its palette; categories the config paints alike,
 * through `unknown` or a repeated `range` color, stay one.
 */
export function categoriesByColor(scale: ColorScaleTable | undefined) {
  const byColor = new Map<number, string[]>()
  if (scale?.kind === 'categorical' || scale?.kind === 'identity') {
    for (const { value, color } of scale.entries) {
      byColor.set(color, [...(byColor.get(color) ?? []), value])
    }
  }
  return new Map(
    [...byColor].map(([color, values]) => [
      color,
      values.toSorted(compareGroupKeys).join(', '),
    ]),
  )
}

/**
 * A sort over categories, as multi-row's: rows of one category together,
 * the category most rows show first, then in the categories' own order.
 */
export function byCategoryBlocks(valueByName: ReadonlyMap<string, string>) {
  const size = new Map<string, number>()
  for (const v of valueByName.values()) {
    size.set(v, (size.get(v) ?? 0) + 1)
  }
  return (a: string, b: string) =>
    size.get(b)! - size.get(a)! || compareGroupKeys(a, b)
}

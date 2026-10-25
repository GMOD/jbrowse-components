import { isJexl } from '@jbrowse/core/util/jexlStrings'

import { readsValue } from './markSpecs.ts'

import type { ColorSource } from './markColor.ts'
import type { MarkType } from './markVocabulary.ts'

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
 * The first drawing mark standing at a value, else the first drawing span,
 * and what its rows compare on; undefined where neither draws.
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
  const span = drawing.find(i => markTypes[i] === 'rect')
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
 * A sort over painted colors: rows of one color together, the color most
 * rows show first, then by color.
 */
export function byBlockSize(valueByName: ReadonlyMap<string, number>) {
  const size = new Map<number, number>()
  for (const v of valueByName.values()) {
    size.set(v, (size.get(v) ?? 0) + 1)
  }
  return (a: number, b: number) => size.get(b)! - size.get(a)! || a - b
}

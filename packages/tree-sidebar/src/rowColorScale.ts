import { dealRowColors } from '@jbrowse/display-kit/colorConfigSchema'

import { otherName } from './arrangeRows.ts'

import type { RowAlias } from './arrangeRows.ts'
import type { RowSource } from './types.ts'

/** A `rowColor` object's field and the colours it pairs with that field's values. */
export interface RowColorEntries {
  field: string
  domain: readonly string[]
  range: readonly string[]
}

/** What `dealtValueColors` reads of a `rowColor` object. */
export interface RowColorDealSetting extends RowColorEntries {
  scale?: string
  unknown?: string
}

const NONE: ReadonlyMap<string, string> = new Map()

/**
 * The colour `setting` gives each value of its field over `rowsOf()`, the
 * rows in the base arrangement: its pairs, and the row palette dealt over the
 * rest by `dealRowColors`. An attribute's values deal always, first seen
 * first; a row name deals only while `namesDeal` or an `unknown` stands in for
 * the palette, and a row with its own colour takes no turn. None under
 * `scale: 'none'`, or for an attribute no row carries. Reads no row where only
 * the pairs paint, so a reorder deals nothing again.
 */
export function dealtValueColors(
  setting: RowColorDealSetting,
  rowsOf: () => readonly RowSource[],
  namesDeal: boolean,
): ReadonlyMap<string, string> {
  const { field, scale, unknown } = setting
  if (scale === 'none') {
    return NONE
  }
  if (field === 'name') {
    return dealRowColors(
      namesDeal || unknown !== undefined
        ? rowsOf()
            .filter(row => row.color === undefined)
            .map(row => row.name)
        : [],
      setting,
    )
  }
  const rows = rowsOf()
  return rows.some(row => Object.hasOwn(row, field))
    ? dealRowColors(
        rows.map(row => rowFieldValue(row, field)),
        setting,
      )
    : NONE
}

/**
 * Each row's colour, by name: what `dealt` gives its value of `field` (under
 * `name`, its own entry, else its alias's), else its own `color`.
 */
export function resolveRowColors(
  rows: readonly RowSource[],
  field: string,
  dealt: ReadonlyMap<string, string>,
  alias: RowAlias | undefined,
): ReadonlyMap<string, string> {
  const colors = new Map<string, string>()
  const aliased = dealt.size > 0 ? alias : undefined
  for (const row of rows) {
    const color =
      (field === 'name'
        ? (dealt.get(row.name) ?? aliasColor(dealt, row.name, aliased))
        : dealt.get(rowFieldValue(row, field))) ?? row.color
    if (color !== undefined) {
      colors.set(row.name, color)
    }
  }
  return colors
}

function aliasColor(
  dealt: ReadonlyMap<string, string>,
  name: string,
  alias: RowAlias | undefined,
) {
  const other = alias && otherName(alias, name)
  return other === undefined ? undefined : dealt.get(other)
}

/** `field`'s value on `row`, `''` where the row has none of its own. */
export function rowFieldValue(row: object, field: string) {
  const value: unknown = Object.hasOwn(row, field)
    ? Reflect.get(row, field)
    : undefined
  return value === undefined || value === null ? '' : String(value)
}

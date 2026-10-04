import { MAX_LEGEND_ITEMS } from '@jbrowse/core/ui/legendSpec'
import { dealRowColors } from '@jbrowse/display-kit/colorConfigSchema'

import { otherName } from './arrangeRows.ts'

import type { RowAlias } from './arrangeRows.ts'
import type { RowSource } from './types.ts'
import type { CategoricalEntry } from '@jbrowse/core/ui/colorScale'

/**
 * The `rowColor` object as read: the row attribute whose values take the
 * colours, `name` for the rows themselves, the scale, the values paired with
 * a colour, and what an unpaired value takes.
 */
export interface RowColorSetting {
  field: string
  scale: 'none' | 'categorical' | undefined
  domain: readonly string[]
  range: readonly string[]
  unknown?: string
}

const NONE: ReadonlyMap<string, string> = new Map()

/**
 * The colour `setting` gives each value of its field over `rowsOf()`, the
 * rows in the base arrangement: its pairs, and the row palette dealt over the
 * rest by `dealRowColors`. An attribute's values deal always, first seen
 * first, except the empty value, which takes a colour only from a pair: a row
 * with no value is missing, not a category, as ggplot's `na.value`. A row name
 * deals only while `namesDeal` or an `unknown` stands in for the palette, and
 * a row with its own colour takes no turn. None under
 * `scale: 'none'`, or for an attribute no row carries. Reads no row where only
 * the pairs paint, so a reorder deals nothing again.
 */
export function dealtValueColors(
  setting: RowColorSetting,
  rowsOf: () => readonly RowSource[],
  namesDeal: boolean,
): ReadonlyMap<string, string> {
  const { field, scale, unknown } = setting
  if (scale === 'none') {
    return NONE
  }
  if (field === 'name') {
    return dealRowColors(
      namesDeal || (unknown !== undefined && unknown !== '')
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
        rows
          .map(row => rowFieldValue(row, field))
          .filter(value => value !== ''),
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

/**
 * Each row carrying its colour from `colors` as `rowColor`; `rows` itself
 * while every row already does.
 */
export function withRowColors<S extends RowSource>(
  rows: S[],
  colors: ReadonlyMap<string, string>,
): S[] {
  let out: S[] | undefined
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowColor = colors.get(row.name)
    if (rowColor !== row.rowColor) {
      out ??= [...rows]
      out[i] = { ...row, rowColor }
    }
  }
  return out ?? rows
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

/** The id of the row colour key's scale, which `focusLegendEntry` answers. */
export const ROW_COLOR_SCALE_ID = 'rowColor'

const OTHER_VALUE = '\u0000other'

/** What the row colour key reads: the setting and the colours it resolved. */
export interface RowColorKeyInputs {
  setting: RowColorSetting
  pairs: ReadonlyMap<string, string>
  dealt: ReadonlyMap<string, string>
  resolved: ReadonlyMap<string, string>
}

function keyColor(row: RowSource, value: string, key: RowColorKeyInputs) {
  return key.setting.field === 'name'
    ? key.resolved.get(row.name)
    : key.dealt.get(value)
}

/**
 * The key entry `row` is listed under: its value of the `rowColor` field, the
 * "Other" entry where it took the `unknown` colour, or undefined where it has
 * no value or no colour.
 */
export function rowColorKeyValue(row: RowSource, key: RowColorKeyInputs) {
  const { field, scale, unknown } = key.setting
  const value = field === 'name' ? row.name : rowFieldValue(row, field)
  const color = keyColor(row, value, key)
  if (scale === 'none' || value === '' || color === undefined) {
    return undefined
  }
  return color === unknown && !key.pairs.has(value) ? OTHER_VALUE : value
}

/**
 * The row colour key over `rows`, the rows in the base arrangement: an entry
 * per value some row carries with a colour, in deal order, at most
 * `MAX_LEGEND_ITEMS` and then a "+N more" note, and a trailing "Other" in the
 * `unknown` colour where a row took it.
 */
export function rowColorKeyEntries(
  rows: readonly RowSource[],
  key: RowColorKeyInputs,
  labelOf: (name: string) => string,
): CategoricalEntry[] {
  const { field, unknown } = key.setting
  const listed = new Map<string, CategoricalEntry>()
  let other = false
  for (const row of rows) {
    const value = rowColorKeyValue(row, key)
    if (value === OTHER_VALUE) {
      other = true
    } else if (value !== undefined && !listed.has(value)) {
      listed.set(value, {
        value,
        label: field === 'name' ? labelOf(value) : value,
        color: keyColor(row, value, key),
      })
    }
  }
  const entries =
    field === 'name'
      ? [...listed.values()]
      : [...key.dealt.keys()].flatMap(value => listed.get(value) ?? [])
  const more = entries.length - MAX_LEGEND_ITEMS
  return [
    ...entries.slice(0, MAX_LEGEND_ITEMS),
    ...(more > 0 ? [{ value: '', label: `+${more} more` }] : []),
    ...(other && unknown
      ? [{ value: OTHER_VALUE, label: 'Other', color: unknown }]
      : []),
  ]
}

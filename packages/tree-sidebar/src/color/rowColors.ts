import { dealRowColors } from '@jbrowse/display-kit/colorConfigSchema'

import { otherName } from '../rows/arrangeRows.ts'
import { rowFieldValue } from '../rows/rowFields.ts'
import { withPairs } from './rowColorChoice.ts'

import type { RowAlias } from '../rows/arrangeRows.ts'
import type { RowSource } from '../types.ts'

/** The `rows.color.scale` as read: the values paired with a color, and what an unpaired value takes. */
export interface RowColorScaleSetting {
  domain: readonly string[]
  range: readonly string[]
  unknown?: string
}

/**
 * The `rows.color` object as read: the row field whose values take the
 * colors, `name` for the rows themselves, and its `scale`. Under `name`,
 * `withPinnedColors` folds `rows.colors` in as the scale's pairs, which is
 * the one shape every rule here reads.
 */
export interface RowColorSetting {
  field: string
  scale: RowColorScaleSetting
}

/**
 * `channel`, `rows.color`, with `pinned`, `rows.colors`, as its pairs under
 * `name`, ahead of the palette `scale.range` deals the other rows; under an
 * attribute the pins sit on top (`resolveRowColors`) and `channel` stands.
 */
export function withPinnedColors(
  channel: RowColorSetting,
  pinned: ReadonlyMap<string, string>,
): RowColorSetting {
  return channel.field === 'name' && pinned.size > 0
    ? withPairs(channel, pinned)
    : channel
}

/**
 * The key of `colors` the row `name` takes its color from: its own, else its
 * alias's.
 */
export function colorKeyOf(
  colors: ReadonlyMap<string, string>,
  name: string,
  alias: RowAlias | undefined,
) {
  const other =
    colors.has(name) || colors.size === 0 || !alias
      ? undefined
      : otherName(alias, name)
  return colors.has(name)
    ? name
    : other !== undefined && colors.has(other)
      ? other
      : undefined
}

/** The color `colors` gives the row `name`, its own else its alias's. */
function colorOf(
  colors: ReadonlyMap<string, string>,
  name: string,
  alias: RowAlias | undefined,
) {
  const key = colorKeyOf(colors, name, alias)
  return key === undefined ? undefined : colors.get(key)
}

const NONE: ReadonlyMap<string, string> = new Map()

/**
 * The color `setting` gives each value of its field over `rowsOf()`, the
 * rows in source order: its pairs, and the row palette dealt over the
 * rest by `dealRowColors`. A field's values deal always, first seen
 * first, except the empty value, which takes a color only from a pair: a row
 * with no value is missing, not a category, as ggplot's `na.value`. A row name
 * deals only while `namesDeal` or a `scale.unknown` stands in for the palette, and
 * a row with its own color takes no turn. None for a field no row
 * carries. Reads no row where only the pairs paint, so a reorder deals nothing
 * again. `declared` lists values of a field the config states, which
 * take their turns first, loaded or not. `deck` deals in the row palette's
 * place.
 */
export function dealValueColors(
  setting: RowColorSetting,
  rowsOf: () => readonly RowSource[],
  namesDeal: boolean,
  declared: readonly string[] = [],
  deck?: (position: number) => string,
): ReadonlyMap<string, string> {
  const { field, scale } = setting
  const { unknown } = scale
  if (field === 'name') {
    return dealRowColors(
      unknown !== '' && (namesDeal || unknown !== undefined)
        ? rowsOf()
            .filter(row => row.color === undefined)
            .map(row => row.name)
        : [],
      scale,
      deck,
    )
  }
  const rows = rowsOf()
  return rows.some(row => Object.hasOwn(row, field))
    ? dealRowColors(
        [...declared, ...rows.map(row => rowFieldValue(row, field))].filter(
          value => value !== '',
        ),
        scale,
        deck,
      )
    : NONE
}

/**
 * Each row's color, by name: the color `pinned` (`rows.colors`) gives it, its
 * own entry else its alias's, so a haplotype row takes its sample's pin over
 * the `scale.unknown` its own name is dealt; else what `dealt` gives its name
 * (its own entry, else its alias's) or its value of the attribute; else its
 * own `color`.
 */
export function resolveRowColors(
  rows: readonly RowSource[],
  field: string,
  dealt: ReadonlyMap<string, string>,
  pinned: ReadonlyMap<string, string>,
  alias: RowAlias | undefined,
): ReadonlyMap<string, string> {
  const colors = new Map<string, string>()
  for (const row of rows) {
    const color =
      colorOf(pinned, row.name, alias) ??
      (field === 'name'
        ? colorOf(dealt, row.name, alias)
        : dealt.get(rowFieldValue(row, field))) ??
      row.color
    if (color !== undefined) {
      colors.set(row.name, color)
    }
  }
  return colors
}

/**
 * Each row carrying its resolved color from `colors` as `rowColor`; `rows`
 * itself while every row already does.
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

import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'
import { dealRowColors } from '@jbrowse/display-kit/colorConfigSchema'

import { otherName } from './arrangeRows.ts'

import type { RowAlias } from './arrangeRows.ts'
import type { RowSource } from './types.ts'
import type { CategoricalEntry } from '@jbrowse/core/ui/colorScale'

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
    ? {
        ...channel,
        scale: {
          ...channel.scale,
          domain: [...pinned.keys()],
          range: [...pinned.values(), ...channel.scale.range],
        },
      }
    : channel
}

/** The color `pinned` gives the row `name`, its own else its alias's. */
export function pinnedColorOf(
  pinned: ReadonlyMap<string, string>,
  name: string,
  alias: RowAlias | undefined,
) {
  return pinned.size > 0
    ? (pinned.get(name) ?? aliasColor(pinned, name, alias))
    : undefined
}

/** The `rows.colors` entry giving the row `name` its color, or undefined. */
function pinnedKeyOf(
  pinned: ReadonlyMap<string, string>,
  name: string,
  alias: RowAlias | undefined,
) {
  const other = pinned.size > 0 && alias ? otherName(alias, name) : undefined
  return pinned.has(name)
    ? name
    : other !== undefined && pinned.has(other)
      ? other
      : undefined
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
 * take their turns first, loaded or not.
 */
export function dealValueColors(
  setting: RowColorSetting,
  rowsOf: () => readonly RowSource[],
  namesDeal: boolean,
  declared: readonly string[] = [],
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
    )
  }
  const rows = rowsOf()
  return rows.some(row => Object.hasOwn(row, field))
    ? dealRowColors(
        [...declared, ...rows.map(row => rowFieldValue(row, field))].filter(
          value => value !== '',
        ),
        scale,
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
  const aliased = dealt.size > 0 ? alias : undefined
  for (const row of rows) {
    const color =
      pinnedColorOf(pinned, row.name, alias) ??
      (field === 'name'
        ? (dealt.get(row.name) ?? aliasColor(dealt, row.name, aliased))
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

/** The id of the row color key's scale, which `focusLegendEntry` answers. */
export const ROW_COLOR_SCALE_ID = 'rows.color'

const OTHER_VALUE = '\u0000other'
const NO_VALUE = '\u0000none'
const PINNED_VALUE = '\u0000pinned:'

/**
 * What the row color key reads: the setting (`rows.color` with the pins
 * folded in under `name`), the pins themselves, and the colors it resolved.
 */
export interface RowColorKeyInputs {
  setting: RowColorSetting
  pairs: ReadonlyMap<string, string>
  dealt: ReadonlyMap<string, string>
  resolved: ReadonlyMap<string, string>
  pinned: ReadonlyMap<string, string>
  alias: RowAlias | undefined
}

function keyColor(row: RowSource, value: string, key: RowColorKeyInputs) {
  return key.setting.field === 'name' || value === ''
    ? key.resolved.get(row.name)
    : key.dealt.get(value)
}

// Under an attribute, the `rows.colors` entry a row takes its color from,
// which lists it apart from its value's entry
function pinnedKey(row: RowSource, key: RowColorKeyInputs) {
  return key.setting.field === 'name'
    ? undefined
    : pinnedKeyOf(key.pinned, row.name, key.alias)
}

/**
 * The key entry `row` is listed under: under an attribute, its own entry
 * where `rows.colors` pins it a color; else its value of the `rows.color`
 * field, the "(no value)" entry where it has none, the "Other" entry where it
 * took the `scale.unknown` color, or undefined where it has no color.
 */
export function rowColorKeyValue(row: RowSource, key: RowColorKeyInputs) {
  const { field, scale } = key.setting
  const { unknown } = scale
  const pinned = pinnedKey(row, key)
  const value = field === 'name' ? row.name : rowFieldValue(row, field)
  const color = keyColor(row, value, key)
  return pinned !== undefined
    ? `${PINNED_VALUE}${pinned}`
    : color === undefined
      ? undefined
      : value === ''
        ? NO_VALUE
        : color === unknown && !key.pairs.has(value)
          ? OTHER_VALUE
          : value
}

/**
 * The row color key over `rows`, the rows in source order: an entry
 * per value some row carries with a color, in deal order, then under an
 * attribute an entry by label for each row `rows.colors` pins, then
 * "(no value)" in the color of the first colored row with no value, and a
 * trailing "Other" in the `scale.unknown` color where a row took it.
 */
export function rowColorKeyEntries(
  rows: readonly RowSource[],
  key: RowColorKeyInputs,
  labelOf: (name: string) => string,
): CategoricalEntry[] {
  const { field, scale } = key.setting
  const { unknown } = scale
  const listed = new Map<string, CategoricalEntry>()
  const pins = new Map<string, CategoricalEntry>()
  let other = false
  let noValue: CategoricalEntry | undefined
  for (const row of rows) {
    const value = rowColorKeyValue(row, key)
    const pinned = pinnedKey(row, key)
    if (pinned !== undefined && value !== undefined) {
      if (!pins.has(value)) {
        pins.set(value, {
          value,
          label: labelOf(pinned),
          color: key.pinned.get(pinned),
        })
      }
    } else if (value === OTHER_VALUE) {
      other = true
    } else if (value === NO_VALUE) {
      noValue ??= {
        value,
        label: NO_VALUE_LABEL,
        color: key.resolved.get(row.name),
        missing: true,
      }
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
  return [
    ...entries,
    ...pins.values(),
    ...(noValue ? [noValue] : []),
    ...(other && unknown
      ? [{ value: OTHER_VALUE, label: 'Other', color: unknown }]
      : []),
  ]
}

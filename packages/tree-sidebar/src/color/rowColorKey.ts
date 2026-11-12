import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'

import { rowFieldValue } from '../rows/rowFields.ts'
import { colorKeyOf } from './rowColors.ts'

import type { RowAlias } from '../rows/arrangeRows.ts'
import type { Row } from '../types.ts'
import type { RowColorSetting } from './rowColors.ts'
import type { CategoricalEntry } from '@jbrowse/core/ui/colorScale'

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

function keyColor(row: Row, value: string, key: RowColorKeyInputs) {
  return key.setting.field === 'name' || value === ''
    ? key.resolved.get(row.name)
    : key.dealt.get(value)
}

// Under an attribute, the `rows.colors` entry a row takes its color from,
// which lists it apart from its value's entry
function pinnedKey(row: Row, key: RowColorKeyInputs) {
  return key.setting.field === 'name'
    ? undefined
    : colorKeyOf(key.pinned, row.name, key.alias)
}

/**
 * The key entry `row` is listed under: under an attribute, its own entry
 * where `rows.colors` pins it a color; else its value of the `rows.color`
 * field, the "(no value)" entry where it has none, the "Other" entry where it
 * took the `scale.unknown` color, or undefined where it has no color.
 */
export function rowColorKeyValue(row: Row, key: RowColorKeyInputs) {
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
  rows: readonly Row[],
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

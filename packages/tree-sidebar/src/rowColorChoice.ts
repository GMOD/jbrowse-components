import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { compareStructural } from 'mobx'

import type { RowColorSetting } from './rowColorScale.ts'

/** The `rowColor` object as a config or the dialog writes it. */
export type RowColorSnapshot = Partial<RowColorSetting>

/**
 * `value` read as a `RowColorSetting`, the one shape every rule below takes:
 * a string is its field, a missing or empty field is `name`, and a `domain`
 * written as numbers reads as the strings the schema carries.
 */
export function liftRowColor(value: unknown): RowColorSetting {
  const snap: RowColorSnapshot =
    typeof value === 'string'
      ? { field: value }
      : ((value as RowColorSnapshot | undefined) ?? {})
  return {
    field: snap.field || 'name',
    domain: (snap.domain ?? []).map(String),
    range: snap.range ?? [],
    ...(snap.unknown == null ? {} : { unknown: snap.unknown }),
  }
}

/** The members a `rowColor` write carries: the set ones, and no empty list. */
export function rowColorMembers(setting: RowColorSetting): RowColorSnapshot {
  return Object.fromEntries(
    Object.entries(setting).filter(
      ([, value]) =>
        value !== undefined && !(Array.isArray(value) && value.length === 0),
    ),
  )
}

function pairsOf(setting: RowColorSetting): Record<string, string> {
  return Object.fromEntries(pairedColorsOf(setting))
}

export function sameRowColor(a: RowColorSetting, b: RowColorSetting) {
  return (
    a.field === b.field &&
    compareStructural(a.domain, b.domain) &&
    compareStructural(a.range, b.range) &&
    a.unknown === b.unknown
  )
}

/**
 * What the dialog and a menu show `setting` as: '' for None, where nothing
 * deals the rows a colour each, under `name` with no palette dealing
 * (`paletteDeals`) or an `unknown: ''` holding it off; else its field, `name`
 * for Each row.
 */
export function rowColorChoiceOf(
  { field, unknown }: RowColorSetting,
  paletteDeals: boolean,
): string {
  return field === 'name' && (!paletteDeals || unknown === '') ? '' : field
}

/**
 * The `unknown` a dialog choice carries over from `current`: the one the
 * config sets on the same field, so None on stacked rows keeps the grey the
 * unlisted rows wear, except a `''` under Each row, which is None.
 */
export function keptUnknown(
  current: RowColorSetting,
  choice: string,
): string | undefined {
  return current.field === (choice || 'name') &&
    !(choice === 'name' && current.unknown === '')
    ? current.unknown
    : undefined
}

/**
 * The `rowColor` object a dialog choice writes: None and Each row paint by
 * `name`, an attribute by itself with `pairs` on its values, and `unknown` on
 * the rest, the dialog's Other swatch, which opens on `keptUnknown`. None
 * where the palette deals (`paletteDeals`) is `unknown: ''`, whatever the
 * swatch.
 */
export function rowColorChoiceSetting(
  paletteDeals: boolean,
  choice: string,
  pairs: Record<string, string>,
  unknown: string | undefined,
): RowColorSnapshot {
  const written = choice === '' && paletteDeals ? '' : unknown
  const domain = Object.keys(pairs)
  return {
    field: choice || 'name',
    ...(domain.length ? { domain, range: Object.values(pairs) } : {}),
    ...(written === undefined ? {} : { unknown: written }),
  }
}

/**
 * The `rowColor` object a menu's pick of `choice` writes over `current`: the
 * dialog's object for that choice opened and submitted untouched, so the
 * field already named keeps its pairs and `unknown`, and any other starts
 * with none.
 */
export function rowColorForChoice(
  current: RowColorSetting,
  choice: string,
  paletteDeals: boolean,
): RowColorSnapshot {
  return rowColorChoiceSetting(
    paletteDeals,
    choice,
    current.field === (choice || 'name') ? pairsOf(current) : {},
    keptUnknown(current, choice),
  )
}

/**
 * What "Reset row order" returns the `rowColor` object to, or undefined while
 * `live` already shows it: `live`'s field with the colours `base` gives that
 * field, none where `base` colours by another. A reset recolours and never
 * changes what the rows are coloured by, as no other Color by is undone by
 * a reset, and the target is never itself custom, so one reset is the whole
 * way back.
 */
export function rowColorResetTarget(
  live: RowColorSetting,
  base: RowColorSetting,
): RowColorSetting | undefined {
  const target =
    base.field === live.field ? base : liftRowColor({ field: live.field })
  return live.unknown === target.unknown &&
    compareStructural(pairsOf(live), pairsOf(target))
    ? undefined
    : target
}

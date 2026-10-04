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
    scale: snap.scale,
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

/**
 * The colours `setting` sets on the values of `field`: its pairs while it
 * paints by that field, none while it paints by another or sits under
 * `scale: 'none'`, which parks them.
 */
function pairsOn(
  setting: RowColorSetting,
  field: string,
): Record<string, string> {
  return setting.field === field && setting.scale !== 'none'
    ? Object.fromEntries(pairedColorsOf(setting))
    : {}
}

/** Whether `setting`'s pairs are rows by name, which a row's swatch edits. */
export function paintsNamePairs({ field, scale }: RowColorSetting) {
  return field === 'name' && scale !== 'none'
}

export function sameRowColor(a: RowColorSetting, b: RowColorSetting) {
  return (
    a.field === b.field &&
    (a.scale ?? 'categorical') === (b.scale ?? 'categorical') &&
    compareStructural(a.domain, b.domain) &&
    compareStructural(a.range, b.range) &&
    a.unknown === b.unknown
  )
}

/**
 * What the dialog and a menu show `setting` as: '' for None, where nothing
 * deals the rows a colour each, under `scale: 'none'` or under `name` with no
 * palette dealing (`paletteDeals`) or an `unknown: ''` holding it off; else
 * its field, `name` for Each row.
 */
export function rowColorChoiceOf(
  { field, scale, unknown }: RowColorSetting,
  paletteDeals: boolean,
): string {
  return scale === 'none' ||
    (field === 'name' && (!paletteDeals || unknown === ''))
    ? ''
    : field
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
 * What "Reset row order" returns the `rowColor` object to, or undefined while
 * `live` sets nothing `base` does not. The base's object where a `name` pair
 * or the `unknown` differs, or where one of the two parks under
 * `scale: 'none'` and the other paints; where only an attribute's value
 * colours differ, the attribute with the base's colours for it, so a Color by
 * picked over a config setting none is no custom arrangement and survives a
 * reset. The target itself is never custom, so one reset is the whole way
 * back.
 */
export function rowColorResetTarget(
  live: RowColorSetting,
  base: RowColorSetting,
): RowColorSetting | undefined {
  if (
    !compareStructural(pairsOn(live, 'name'), pairsOn(base, 'name')) ||
    live.unknown !== base.unknown ||
    (live.scale === 'none') !== (base.scale === 'none')
  ) {
    return base
  }
  if (compareStructural(pairsOn(live, live.field), pairsOn(base, live.field))) {
    return undefined
  }
  return live.field === base.field
    ? base
    : liftRowColor({ field: live.field, unknown: base.unknown })
}

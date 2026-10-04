import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { compareStructural } from 'mobx'

import type { RowColorSetting } from './rowColorScale.ts'

/**
 * The `rowColor` object as a config or the dialog writes it: a string is its
 * field, and a missing or empty field is `name`.
 */
export type RowColorSnapshot = Partial<RowColorSetting>

/** `value` read as a `RowColorSetting`, the one shape every rule below takes. */
export function liftRowColor(value: unknown): RowColorSetting {
  const snap: RowColorSnapshot =
    typeof value === 'string'
      ? { field: value }
      : ((value as RowColorSnapshot | undefined) ?? {})
  return {
    field: snap.field || 'name',
    scale: snap.scale,
    domain: snap.domain ?? [],
    range: snap.range ?? [],
    ...(snap.unknown === undefined ? {} : { unknown: snap.unknown }),
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
export function pairsOn(
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
 * The `rowColor` object a dialog choice writes over `current`: None and Each
 * row paint by `name`, an attribute by itself with `pairs` on its values. An
 * `unknown` the config sets on the same field stays, so None on stacked rows
 * keeps the grey the unlisted rows wear, except that None where the palette
 * deals is `unknown: ''`, and Each row drops a `''`, which is None.
 */
export function rowColorChoiceSetting(
  current: RowColorSetting,
  paletteDeals: boolean,
  choice: string,
  pairs: Record<string, string> = {},
): RowColorSnapshot {
  const field = choice || 'name'
  const unknown =
    choice === '' && paletteDeals
      ? ''
      : current.field === field &&
          !(choice === 'name' && current.unknown === '')
        ? current.unknown
        : undefined
  const domain = Object.keys(pairs)
  return {
    field,
    ...(domain.length ? { domain, range: Object.values(pairs) } : {}),
    ...(unknown === undefined ? {} : { unknown }),
  }
}

/**
 * What "Reset row order" returns the `rowColor` object to, or undefined while
 * `live` sets nothing `base` does not. The base's object where a `name` pair
 * or the `unknown` differs; where only an attribute's value colours differ,
 * the attribute with the base's colours for it, so a Color by picked over a
 * config setting none is no custom arrangement and survives a reset. The
 * target itself is never custom, so one reset is the whole way back.
 */
export function rowColorResetTarget(
  live: RowColorSetting,
  base: RowColorSetting,
): RowColorSetting | undefined {
  if (
    !compareStructural(pairsOn(live, 'name'), pairsOn(base, 'name')) ||
    live.unknown !== base.unknown
  ) {
    return base
  }
  if (compareStructural(pairsOn(live, live.field), pairsOn(base, live.field))) {
    return undefined
  }
  return live.field === base.field
    ? base
    : {
        field: live.field,
        scale: undefined,
        domain: [],
        range: [],
        ...(base.unknown === undefined ? {} : { unknown: base.unknown }),
      }
}

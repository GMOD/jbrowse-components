import { capitalizeFirst } from '@jbrowse/core/util'
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

/** The `range` entries past `domain`, which `dealRowColors` deals first. */
function spareRange({ domain, range }: RowColorSetting) {
  return range.slice(domain.length)
}

/**
 * Whether `a` and `b` pair the same values with the same colours and deal the
 * same spare `range` entries.
 */
export function samePairs(a: RowColorSetting, b: RowColorSetting) {
  return (
    compareStructural(
      Object.fromEntries(pairedColorsOf(a)),
      Object.fromEntries(pairedColorsOf(b)),
    ) && compareStructural(spareRange(a), spareRange(b))
  )
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
 * `setting` with `value` paired to `color`, in place or appended, keeping the
 * spare `range` entries the unpaired values take.
 */
export function withPair(
  setting: RowColorSetting,
  value: string,
  color: string,
): RowColorSetting {
  const pairs = new Map(pairedColorsOf(setting)).set(value, color)
  return {
    ...setting,
    domain: [...pairs.keys()],
    range: [...pairs.values(), ...spareRange(setting)],
  }
}

/**
 * What the dialog and a menu show `setting` as: its field, `name` for Each
 * row, or '' for None where it colours no row: `name` with no pair and an
 * `unknown` of '', or unset where no palette deals (`paletteDeals`).
 */
export function rowColorChoiceOf(
  setting: RowColorSetting,
  paletteDeals: boolean,
): string {
  const { field, unknown } = setting
  return field === 'name' &&
    pairedColorsOf(setting).size === 0 &&
    (unknown === '' || (unknown === undefined && !paletteDeals))
    ? ''
    : field
}

/** What a menu and the dialog call `choice`. */
export function rowColorChoiceLabel(choice: string) {
  return choice === ''
    ? 'None'
    : choice === 'name'
      ? 'Each row'
      : capitalizeFirst(choice)
}

/**
 * The `rowColor` object a choice starts from: None's, which colours no row;
 * else the first of `from` showing that choice, the current object then the
 * config's, so a reader's colours stand and a config's return; else the
 * field with no colour of its own.
 */
export function startingRowColor(
  choice: string,
  from: readonly RowColorSetting[],
  paletteDeals: boolean,
): RowColorSetting {
  return choice === ''
    ? liftRowColor({ field: 'name', unknown: paletteDeals ? '' : undefined })
    : (from.find(
        setting => rowColorChoiceOf(setting, paletteDeals) === choice,
      ) ?? liftRowColor({ field: choice }))
}

/**
 * What "Reset row order" returns the `rowColor` object to, or undefined while
 * `live` already shows it: the object `live`'s choice starts from in `base`,
 * and nothing under None, which has no colour to return. A reset recolours
 * and never changes the choice, as no other Color by is undone by a reset,
 * and the target is never itself custom, so one reset is the whole way back.
 * Pairs compare as a set.
 */
export function rowColorResetTarget(
  live: RowColorSetting,
  base: RowColorSetting,
  paletteDeals: boolean,
): RowColorSetting | undefined {
  const choice = rowColorChoiceOf(live, paletteDeals)
  if (choice === '') {
    return undefined
  }
  const target = startingRowColor(choice, [base], paletteDeals)
  return live.unknown === target.unknown && samePairs(live, target)
    ? undefined
    : target
}

import { readConfObject } from '@jbrowse/core/configuration'
import { capitalizeFirst } from '@jbrowse/core/util'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { compareStructural } from 'mobx'

import type { RowColorScaleSetting, RowColorSetting } from './rowColorScale.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/** The `rowColor` object as a config or the dialog writes it. */
export interface RowColorSnapshot {
  field?: string
  scale?: Partial<RowColorScaleSetting>
}

/**
 * `value` read as a `RowColorSetting`, the one shape every rule below takes:
 * a string is its field, a missing or empty field is `name`, and a
 * `scale.domain` written as numbers reads as the strings the schema carries.
 */
export function liftRowColor(value: unknown): RowColorSetting {
  const snap: RowColorSnapshot =
    typeof value === 'string'
      ? { field: value }
      : ((value as RowColorSnapshot | undefined) ?? {})
  const { domain = [], range = [], unknown } = snap.scale ?? {}
  return {
    field: snap.field || 'name',
    scale: {
      domain: domain.map(String),
      range,
      ...(unknown == null ? {} : { unknown }),
    },
  }
}

/** A `rowColor` config node read as a `RowColorSetting`. */
export function rowColorSettingOf(
  rowColor: AnyConfigurationModel,
): RowColorSetting {
  return liftRowColor({
    field: readConfObject(rowColor, 'field'),
    scale: {
      domain: readConfObject(rowColor, ['scale', 'domain']),
      range: readConfObject(rowColor, ['scale', 'range']),
      unknown: readConfObject(rowColor, ['scale', 'unknown']),
    },
  })
}

/**
 * The members a `rowColor` write carries: the set ones, no empty list, and
 * no empty `scale`.
 */
export function rowColorMembers(setting: RowColorSetting): RowColorSnapshot {
  const scale = Object.fromEntries(
    Object.entries(setting.scale).filter(
      ([, value]) =>
        value !== undefined && !(Array.isArray(value) && value.length === 0),
    ),
  )
  return {
    field: setting.field,
    ...(Object.keys(scale).length > 0 ? { scale } : {}),
  }
}

/** The `range` entries past `domain`, which `dealRowColors` deals first. */
function spareRange({ domain, range }: RowColorScaleSetting) {
  return range.slice(domain.length)
}

/**
 * Whether `a` and `b` pair the same values with the same colors and deal the
 * same spare `range` entries.
 */
export function samePairs(a: RowColorSetting, b: RowColorSetting) {
  return (
    compareStructural(
      Object.fromEntries(pairedColorsOf(a.scale)),
      Object.fromEntries(pairedColorsOf(b.scale)),
    ) && compareStructural(spareRange(a.scale), spareRange(b.scale))
  )
}

export function sameRowColor(a: RowColorSetting, b: RowColorSetting) {
  return (
    a.field === b.field &&
    compareStructural(a.scale.domain, b.scale.domain) &&
    compareStructural(a.scale.range, b.scale.range) &&
    a.scale.unknown === b.scale.unknown
  )
}

/**
 * `setting` with `pairs` as its pairs, keeping the spare `range` entries the
 * unpaired values take.
 */
export function withPairs(
  setting: RowColorSetting,
  pairs: ReadonlyMap<string, string>,
): RowColorSetting {
  return {
    ...setting,
    scale: {
      ...setting.scale,
      domain: [...pairs.keys()],
      range: [...pairs.values(), ...spareRange(setting.scale)],
    },
  }
}

/** `setting` with `value` paired to `color`, in place or appended. */
export function withPair(
  setting: RowColorSetting,
  value: string,
  color: string,
): RowColorSetting {
  return withPairs(
    setting,
    new Map(pairedColorsOf(setting.scale)).set(value, color),
  )
}

/**
 * What the dialog and a menu show `setting` as: its field, `name` for Each
 * row, or '' for None where it colors no row: `name` with no pair and an
 * `scale.unknown` of '', or unset where no palette deals (`paletteDeals`).
 */
export function rowColorChoiceOf(
  setting: RowColorSetting,
  paletteDeals: boolean,
): string {
  const { field, scale } = setting
  const { unknown } = scale
  return field === 'name' &&
    pairedColorsOf(scale).size === 0 &&
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
 * The `rowColor` object a choice starts from: None's, which colors no row;
 * else the first of `from` showing that choice, the current object then the
 * config's, so a reader's colors stand and a config's return; else the
 * field with no color of its own.
 */
export function startingRowColor(
  choice: string,
  from: readonly RowColorSetting[],
  paletteDeals: boolean,
): RowColorSetting {
  return choice === ''
    ? liftRowColor({
        field: 'name',
        scale: { unknown: paletteDeals ? '' : undefined },
      })
    : (from.find(
        setting => rowColorChoiceOf(setting, paletteDeals) === choice,
      ) ?? liftRowColor({ field: choice }))
}

/**
 * What "Reset row order" returns the `rowColor` object to, or undefined while
 * `live` already shows it: the object `live`'s choice starts from in `base`,
 * and nothing under None, which has no color to return. A reset recolors
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
  return live.scale.unknown === target.scale.unknown && samePairs(live, target)
    ? undefined
    : target
}

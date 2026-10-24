import { categoricalColorScale } from '../ui/colors.ts'
import { NO_CATEGORY_COLOR } from './color/index.ts'
import { universalPresetOf } from './colorScale.ts'
import { groupKeyComparator, valueText } from './groupKeys.ts'
import { isJexl } from './jexlStrings.ts'

import type { CategoricalScale, HeldSlots } from '../ui/colors.ts'

/** #api */
export const STRAND_FIELD = 'strand'

/**
 * #api
 * The structural-variant class `svClassOf` names. A VCF record and a BEDPE
 * row have it, and the mark display's `mate` step writes it per allele.
 */
export const SV_TYPE_FIELD = 'svType'

/**
 * #api
 * The row a feature with no categorical value is placed on, so a key
 * says why a mark is grey rather than listing a blank value.
 */
export const NO_VALUE_LABEL = '(no value)'

/**
 * #api
 * The key's row for the values a color's `domain` leaves out, which its
 * `unknown` paints one color.
 */
export const OTHER_VALUES_LABEL = 'Other'

/**
 * #api
 * One categorical field as every channel reads it — a facet's sections, a
 * color's range entries, a key's rows. `key` files a value, `compare`
 * orders keys (the `domain` first, the rest by `compareGroupKeys`, `''`
 * after them), `label` names a key in a legend, `sectionLabel` on a chip, and
 * `color` paints it. A key's color depends only on the key and the
 * declaration, so every region agrees on it, except that a field dealing its
 * colors (`categoricalField`'s `held`) also steps a key off the colors of the
 * keys met before it.
 */
export interface CategoricalField {
  field: string
  /** The declared order, or the field's own where none is declared. */
  domain: readonly string[]
  /**
   * Every key a value can file under is in `domain`, as a threshold scale's
   * bins are, so a key lists all of them whether or not anything painted one.
   */
  closed?: boolean
  key: (value: unknown) => string
  compare: (a: string, b: string) => number
  label: (key: string) => string
  sectionLabel: (key: string) => string
  color: (key: string) => string
  /** `key`'s color dealt with `batch`, as `dealKeyColors` deals one */
  colorAmong?: (key: string, batch: ReadonlySet<string>) => string
  /**
   * The one color every key `domain` leaves out paints, and which keys those
   * are, so a key ordered by another field's domain still names them.
   */
  unknown?: { color: string; paints: (key: string) => boolean }
  /**
   * The written color of the no-value key, `''` or a preset's own missing
   * level, Vega-Lite's `invalid`
   */
  invalid?: string
}

/**
 * #api
 * The display name of each of `keys`, from a color object's `labels`: one each
 * in order, and the key itself where an entry is empty or missing. Every key
 * that takes `labels` reads them through this, so a config means one thing by
 * them everywhere.
 */
export function keyNames(
  keys: readonly unknown[],
  labels: readonly string[] = [],
): ReadonlyMap<string, string> {
  const names = new Map<string, string>()
  keys.forEach((key, i) => {
    const name = labels[i]
    const text = String(key)
    if (name && !names.has(text)) {
      names.set(text, name)
    }
  })
  return names
}

/**
 * #api
 * `labels` names the `domain`'s values in a key, one each in order, where a
 * config spells them for a reader rather than as the data does. `held` deals
 * each key the domain does not list a color when the key first appears
 * (`categoricalScale`); the caller keeps it for as long as the colors should
 * hold. `unknown` paints every such key one color instead, `''` the
 * no-value grey, and `invalid` paints the no-value key, `''` or a preset's
 * missing level (strand's `0`), which keeps the grey or the level's own color
 * while unset.
 */
export function categoricalField(
  field: string,
  {
    domain = [],
    range = [],
    labels = [],
    held,
    reserved,
    unknown,
    invalid,
  }: {
    domain?: readonly string[]
    range?: readonly string[]
    labels?: readonly string[]
    held?: HeldSlots
    /** colors a dealt value avoids, `categoricalColorScale`'s */
    reserved?: readonly string[]
    unknown?: string
    invalid?: string
  } = {},
): CategoricalField {
  // a field with a vocabulary of its own reads it on every channel, a facet's
  // sections as well as a color's key
  const vocabulary = universalPresetOf(field)
  const ownOrder = vocabulary?.scale.domain ?? []
  const order = domain.length > 0 ? domain : ownOrder
  const [paired, colors] =
    range.length > 0 || !vocabulary
      ? [order, range]
      : [ownOrder, vocabulary.scale.range ?? []]
  const declared = keyNames(order, labels)
  const own = vocabulary && keyNames(ownOrder, vocabulary.scale.names)
  const named = (key: string) => declared.get(key) ?? own?.get(key)
  const label = (key: string) =>
    named(key) ?? (key === '' ? NO_VALUE_LABEL : key)
  const jexlField = isJexl(field)
  const other = unknown === undefined ? undefined : unknown || NO_CATEGORY_COLOR
  const listed = new Set(order)
  const missingLevel = vocabulary?.missing
  const unlisted = (key: string) =>
    other !== undefined &&
    key !== '' &&
    key !== missingLevel &&
    !listed.has(key)
  const noValueColor = (key: string) =>
    key === ''
      ? invalid || NO_CATEGORY_COLOR
      : key === missingLevel && invalid
        ? invalid
        : undefined
  let colorOf: CategoricalScale<string> | undefined
  return {
    field,
    domain: order,
    ...(other === undefined
      ? {}
      : { unknown: { color: other, paints: unlisted } }),
    ...(invalid ? { invalid } : {}),
    key: value => {
      const key = valueText(value)
      return key === '' ? (vocabulary?.missing ?? key) : key
    },
    compare: groupKeyComparator(order),
    label,
    sectionLabel: key =>
      jexlField
        ? label(key)
        : (named(key) ?? `${field}: ${key === '' ? 'none' : key}`),
    color: key => {
      if (unlisted(key)) {
        return other!
      }
      colorOf ??= categoricalColorScale(paired, colors, held, reserved)
      return noValueColor(key) ?? colorOf(key)
    },
    colorAmong: (key, batch) => {
      if (unlisted(key)) {
        return other!
      }
      colorOf ??= categoricalColorScale(paired, colors, held, reserved)
      return noValueColor(key) ?? colorOf.among(key, batch)
    },
  }
}

/**
 * #api
 * Deals `keys` their colors in `field.compare` order, so the colors a set
 * of keys first seen together takes do not depend on the order they arrive
 * in. Each new key avoids every color the session has dealt, so regions
 * dealing keys separately never repeat a color. A no-op for a field that deals nothing.
 */
export function dealKeyColors(field: CategoricalField, keys: Iterable<string>) {
  for (const key of [...new Set(keys)].sort(field.compare)) {
    field.color(key)
  }
}

/**
 * #api
 * `dealKeyColors` for `keys` that are every value a display shows: each new
 * key avoids only these keys' colors, so the values a session met elsewhere
 * do not use up the palette for the ones on screen. Dealing one region of
 * several this way can put a value on the color of one in the region beside
 * it.
 */
export function dealShownKeyColors(
  field: CategoricalField,
  keys: Iterable<string>,
) {
  const batch = new Set(keys)
  for (const key of [...batch].sort(field.compare)) {
    if (field.colorAmong) {
      field.colorAmong(key, batch)
    } else {
      field.color(key)
    }
  }
}

const heldByOwner = new WeakMap<object, Map<string, HeldSlots>>()

/**
 * #api
 * The `HeldSlots` `owner` keeps under `key`, made empty on first ask. Lives as
 * long as `owner` and is never persisted, so a reload deals afresh.
 */
export function heldSlotsOf(owner: object, key: string) {
  let byKey = heldByOwner.get(owner)
  if (byKey === undefined) {
    byKey = new Map()
    heldByOwner.set(owner, byKey)
  }
  let held = byKey.get(key)
  if (held === undefined) {
    held = new Map()
    byKey.set(key, held)
  }
  return held
}

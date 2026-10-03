import { categoricalColorScale } from '../ui/colors.ts'
import { NO_CATEGORY_COLOR } from './color/index.ts'
import { universalPresetOf } from './colorScale.ts'
import { groupKeyComparator, valueText } from './groupKeys.ts'

import type { HeldSlots } from '../ui/colors.ts'

/** #api */
export const STRAND_FIELD = 'strand'

/**
 * #api
 * The structural-variant class `svClassOf` names. A VCF record and a BEDPE
 * row carry it, and the mark display's `mate` step writes it per allele.
 */
export const SV_TYPE_FIELD = 'svType'

/**
 * #api
 * The row a feature with nothing in a categorical field lands on, so a key
 * says why a mark is grey rather than listing a blank value.
 */
export const NO_VALUE_LABEL = '(no value)'

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
}

/**
 * #api
 * What a key names each of `keys`, from a colour object's `labels`: one each in
 * order, an empty or missing entry leaving that key its own name. Every key
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
 * each key the domain does not list a color of its own on first sight
 * (`categoricalScale`); the caller keeps it for as long as the colors should
 * hold.
 */
export function categoricalField(
  field: string,
  {
    domain = [],
    range = [],
    labels = [],
    held,
  }: {
    domain?: readonly string[]
    range?: readonly string[]
    labels?: readonly string[]
    held?: HeldSlots
  } = {},
): CategoricalField {
  // a field with a vocabulary of its own reads it on every channel, a facet's
  // sections as well as a colour's key
  const vocabulary = universalPresetOf(field)
  const ownOrder = vocabulary?.domain ?? []
  const order = domain.length > 0 ? domain : ownOrder
  const [paired, colors] =
    range.length > 0 || !vocabulary
      ? [order, range]
      : [ownOrder, vocabulary.range ?? []]
  const declared = keyNames(order, labels)
  const own = vocabulary && keyNames(ownOrder, vocabulary.labels)
  const named = (key: string) => declared.get(key) ?? own?.get(key)
  let colorOf: ((key: string) => string) | undefined
  return {
    field,
    domain: order,
    key: value => {
      const key = valueText(value)
      return key === '' ? (vocabulary?.missing ?? key) : key
    },
    compare: groupKeyComparator(order),
    label: key => named(key) ?? (key === '' ? NO_VALUE_LABEL : key),
    sectionLabel: key => named(key) ?? `${field}: ${key === '' ? 'none' : key}`,
    color: key => {
      if (key === '') {
        return NO_CATEGORY_COLOR
      }
      colorOf ??= categoricalColorScale(paired, colors, held)
      return colorOf(key)
    },
  }
}

/**
 * #api
 * Deals `keys` their colours in `field.compare` order, so the colours a set
 * of keys first seen together takes do not depend on the order they arrive
 * in. A no-op for a field that deals nothing.
 */
export function dealKeyColors(field: CategoricalField, keys: Iterable<string>) {
  for (const key of [...new Set(keys)].sort(field.compare)) {
    field.color(key)
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

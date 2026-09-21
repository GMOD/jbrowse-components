import { categoricalColorScale } from '../ui/colors.ts'
import { NO_CATEGORY_COLOR } from './color/index.ts'
import { groupKeyComparator, valueText } from './groupKeys.ts'

/** #api */
export const STRAND_FIELD = 'strand'

/**
 * #api
 * The row a feature with nothing in a categorical field lands on, so a key
 * says why a mark is grey rather than listing a blank value.
 */
export const NO_VALUE_LABEL = '(no value)'

interface Vocabulary {
  /** The key a feature carrying no value files under. */
  missing: string
  domain: readonly string[]
  range: readonly string[]
  labels: Readonly<Record<string, string>>
}

// A field whose values have names, an order and colors of their own, so
// every channel reading it agrees without a config saying so. Red forward and
// blue reverse is the vocabulary the synteny ribbons paint too.
const VOCABULARIES: Readonly<Record<string, Vocabulary>> = {
  [STRAND_FIELD]: {
    missing: '0',
    domain: ['1', '-1', '0'],
    range: ['tomato', 'cornflowerblue', 'goldenrod'],
    labels: {
      '1': 'Forward strand',
      '-1': 'Reverse strand',
      '0': 'No strand',
    },
  },
}

/**
 * #api
 * One categorical field as every channel reads it — a facet's sections, a
 * color's range entries, a key's rows. `key` files a value, `compare`
 * orders keys (the `domain` first, the rest by `compareGroupKeys`, `''`
 * after them), `label` names a key in a legend, `sectionLabel` on a chip, and
 * `color` paints it. A key's color depends only on the key and the
 * declaration, so every region agrees on it.
 */
export interface CategoricalField {
  field: string
  /** The declared order, or the field's own where none is declared. */
  domain: readonly string[]
  key: (value: unknown) => string
  compare: (a: string, b: string) => number
  label: (key: string) => string
  sectionLabel: (key: string) => string
  color: (key: string) => string
}

/** #api */
export function categoricalField(
  field: string,
  {
    domain = [],
    range = [],
  }: { domain?: readonly string[]; range?: readonly string[] } = {},
): CategoricalField {
  const vocabulary = VOCABULARIES[field]
  const order = domain.length > 0 ? domain : (vocabulary?.domain ?? [])
  const colors = range.length > 0 ? range : (vocabulary?.range ?? [])
  const named = (key: string) => vocabulary?.labels[key]
  let colorOf: ((key: string) => string) | undefined
  return {
    field,
    domain: order,
    key: value => {
      const key = valueText(value)
      return key === '' && vocabulary ? vocabulary.missing : key
    },
    compare: groupKeyComparator(order),
    label: key => named(key) ?? (key === '' ? NO_VALUE_LABEL : key),
    sectionLabel: key => named(key) ?? `${field}: ${key === '' ? 'none' : key}`,
    color: key => {
      if (key === '') {
        return NO_CATEGORY_COLOR
      }
      colorOf ??= categoricalColorScale(order, colors)
      return colorOf(key)
    },
  }
}

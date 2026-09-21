import { categoricalPalette } from '../ui/colors.ts'
import { NO_VALUE_LABEL } from './categoricalField.ts'
import { MISCONFIGURED_COLOR, NO_CATEGORY_COLOR } from './color/index.ts'
import { groupKeyComparator, valueText } from './groupKeys.ts'
import { numericValue } from './numericValue.ts'

import type { CategoricalField } from './categoricalField.ts'

/**
 * #api
 * A domain written as strings — the shared `domain` slot is a `stringArray` —
 * read back as the numbers it names. A member that is not a number reads NaN,
 * which every comparison against it declines.
 */
export function numericDomain(domain: readonly (string | number)[]): number[] {
  return domain.map(Number)
}

/**
 * #api
 * A threshold scale's cut points as {@link thresholdIndex} walks them: the
 * numbers the domain names, ascending. Cuts written high to low, as p-value
 * thresholds often are, left the middle interval unreachable, the walk stopping
 * at the first cut a value is under.
 */
export function thresholdCuts(domain: readonly (string | number)[]): number[] {
  return numericDomain(domain)
    .filter(cut => Number.isFinite(cut))
    .sort((a, b) => a - b)
}

/**
 * #api
 * The bin a value falls in: how many of the ascending cut points it is at or
 * past, so a palette with one more entry than the domain paints it as
 * `palette[thresholdIndex(value, domain)]`. A value that is not a finite
 * number is in no bin and answers -1.
 */
export function thresholdIndex(
  value: unknown,
  domain: readonly number[],
): number {
  const v = numericValue(value)
  if (!Number.isFinite(v)) {
    return -1
  }
  let i = 0
  while (i < domain.length && v >= domain[i]!) {
    i++
  }
  return i
}

/**
 * #api
 * The colour of each interval, in order: the declared palette, and the
 * default categorical palette where it runs out.
 */
export function thresholdPalette(
  bins: number,
  palette: readonly string[] = [],
): string[] {
  return Array.from(
    { length: bins },
    (_, i) => palette[i] ?? categoricalPalette[i % categoricalPalette.length]!,
  )
}

/**
 * #api
 * What a threshold scale's bins are called in a key, one label per palette
 * entry: `< a` below the first cut, `a – b` between two, `≥ b` past the last.
 */
export function thresholdLabels(domain: readonly number[]): string[] {
  if (domain.length === 0) {
    return ['any value']
  }
  return [
    `< ${domain[0]}`,
    ...domain.slice(1).map((cut, i) => `${domain[i]} – ${cut}`),
    `≥ ${domain.at(-1)}`,
  ]
}

/**
 * #api
 * The key a value holding text that is no number files under on a threshold
 * scale, painted the misconfiguration grey rather than passing for a missing
 * value.
 */
export const NOT_A_NUMBER_LABEL = '(not a number)'

/**
 * #api
 * A threshold scale read the way every categorical channel reads its field: a
 * value files under the label of the bin it falls in, a feature with no value
 * under `''`, and text that is no number under {@link NOT_A_NUMBER_LABEL}.
 * The bins are the whole domain, so a key lists each one.
 */
export function thresholdField(
  field: string,
  {
    domain = [],
    range = [],
  }: { domain?: readonly string[]; range?: readonly string[] } = {},
): CategoricalField {
  const cuts = thresholdCuts(domain)
  const labels = thresholdLabels(cuts)
  const palette = thresholdPalette(labels.length, range)
  const colorOf = new Map(labels.map((label, i) => [label, palette[i]!]))
  return {
    field,
    domain: labels,
    closed: true,
    key: value => {
      if (valueText(value) === '') {
        return ''
      }
      const bin = thresholdIndex(value, cuts)
      return bin < 0 ? NOT_A_NUMBER_LABEL : labels[bin]!
    },
    compare: groupKeyComparator([...labels, NOT_A_NUMBER_LABEL]),
    label: key => (key === '' ? NO_VALUE_LABEL : key),
    sectionLabel: key => `${field}: ${key === '' ? 'none' : key}`,
    color: key =>
      key === ''
        ? NO_CATEGORY_COLOR
        : (colorOf.get(key) ?? MISCONFIGURED_COLOR),
  }
}

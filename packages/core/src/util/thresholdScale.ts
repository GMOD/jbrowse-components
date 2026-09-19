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
 * The bin a value falls in: how many of the ascending cut points it is at or
 * past, so a palette with one more entry than the domain paints it as
 * `palette[thresholdIndex(value, domain)]`. A value that is not a finite
 * number is in no bin and answers -1.
 */
export function thresholdIndex(
  value: unknown,
  domain: readonly number[],
): number {
  const v = typeof value === 'number' ? value : Number(value)
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

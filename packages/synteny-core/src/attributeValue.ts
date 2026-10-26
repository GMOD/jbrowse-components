const MISSING_TEXT: ReadonlySet<string> = new Set(['', '.', '-', 'NA', 'NULL'])
const NON_FINITE_TEXT = /^[+-]?(?:nan|inf|infinity)$/i
const DECIMAL_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

/**
 * Whether a table cell's text is a missing-value sentinel rather than a
 * value: empty, `.`, `-`, `NA`, `NULL`, or a NaN or infinity spelled any way.
 */
export function isMissingText(text: string) {
  return MISSING_TEXT.has(text) || NON_FINITE_TEXT.test(text)
}

/**
 * A cell as a column reads it: a finite number, the number decimal text
 * spells (a PAF tag's value arrives as text), other text trimmed, or
 * undefined for a missing value.
 */
export function parseAttributeValue(raw: unknown) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : undefined
  }
  if (typeof raw !== 'string') {
    return undefined
  }
  const text = raw.trim()
  return isMissingText(text)
    ? undefined
    : DECIMAL_TEXT.test(text)
      ? Number(text)
      : text
}

/** A label as a ramp reads it: its number, NaN for text. */
export function labelNumber(label: string) {
  const value = parseAttributeValue(label)
  return typeof value === 'number' ? value : Number.NaN
}

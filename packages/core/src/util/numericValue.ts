function textNumber(text: string) {
  const n = Number(text)
  return n === 0 && text.trim() === '' ? Number.NaN : n
}

/**
 * A field's value as the number a quantitative channel or step reads, `NaN`
 * where it holds none. `Number()` answers 0 for `null`, `''`, `[]` and
 * `[null]` — a VCF's `DP=.` arrives as the last — which plots a missing value
 * as a measured zero. A one-element list is its element, as a VCF INFO value
 * is; a string has to hold digits; anything else is not a number.
 *
 * The order is the measurement: a number returns first, and a string converts
 * before its blank check, which runs only on a zero. Over a million features
 * against `Number()`, interleaved in one process: numbers 0.98x, strings
 * 1.00-1.02x, one-element lists 0.28x. Testing the list first and trimming
 * every string measured 1.11-1.16x on a string column.
 */
export function numericValue(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return textNumber(value)
  }
  if (Array.isArray(value) && value.length === 1) {
    const v: unknown = value[0]
    return typeof v === 'number'
      ? v
      : typeof v === 'string'
        ? textNumber(v)
        : Number.NaN
  }
  return Number.NaN
}

/**
 * A field's value as the number a quantitative channel or step reads, `NaN`
 * where it holds none. `Number()` answers 0 for `null`, `''`, `[]` and
 * `[null]` — a VCF's `DP=.` arrives as the last — which plots a missing value
 * as a measured zero. A one-element list is its element, as a VCF INFO value
 * is; a string has to hold digits; anything else is not a number.
 */
export function numericValue(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  const v = Array.isArray(value) && value.length === 1 ? value[0] : value
  return typeof v === 'number'
    ? v
    : typeof v === 'string' && v.trim() !== ''
      ? Number(v)
      : Number.NaN
}

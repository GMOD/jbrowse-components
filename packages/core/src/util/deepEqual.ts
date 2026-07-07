function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Structural equality: identity for primitives, recursive comparison for
 * arrays/objects. Key order doesn't matter, unlike a `JSON.stringify`
 * compare — which also can't tell `NaN` from `null` and silently drops
 * `undefined`-valued keys, so `{ a: 1, b: undefined }` and `{ a: 1 }` would
 * read as equal.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    return (
      ak.length === bk.length && ak.every(k => k in b && deepEqual(a[k], b[k]))
    )
  }
  return false
}

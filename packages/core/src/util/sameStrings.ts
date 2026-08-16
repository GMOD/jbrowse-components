/**
 * Element-wise equality for two string lists, so a setter can skip rewriting
 * observable state with contents it already holds.
 *
 * A primitive prop gets this for free — MobX drops a write of the same number or
 * string — and an array does not: a fresh array is a fresh identity, so every
 * write invalidates everything computed from it however little changed. That
 * makes an unguarded array setter on a per-mousemove path a re-render per raw
 * pointer event, which is how both display families came to want this: the
 * pileup rewriting a chain's read ids while the cursor tracks along one chain,
 * and the canvas display rewriting its tooltip rows while the cursor sits still
 * over one feature.
 */
export function sameStrings(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

/** The same, for a pair that may be absent — two absent lists are equal. */
export function sameOptionalStrings(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
) {
  return a === undefined || b === undefined ? a === b : sameStrings(a, b)
}

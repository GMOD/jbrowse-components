import { isPlainObject } from './objectUtils.ts'

function cloneValue(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(cloneValue)
    : isPlainObject(value)
      ? Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, cloneValue(v)]),
        )
      : value
}

/**
 * Recursive merge of `override` onto `base`, where a nested plain object merges
 * key by key and **an array replaces rather than concatenates**. Both operands
 * are deep-cloned, so neither is aliased by the result — the theme defaults are
 * a module-level constant and a shared nested reference would let one caller's
 * merge corrupt every later one.
 *
 * Replacing arrays is the only behaviour any caller here wanted: `assemblyNames`
 * on a multi-genome track has to become the contributed list, not
 * `[thisAssembly, ...allAssemblies]`, and a theme that names its own array of
 * anything means that array instead of the base's. It is also the reason this
 * exists rather than calling `deepmerge`, whose first overload is
 * `<T>(x: Partial<T>, y: Partial<T>) => T`: passed a `Record<string, unknown>`
 * it inferred `T` from the index signature, erased the shape of the object
 * literal being merged, and handed back something every caller re-narrowed by
 * hand.
 *
 * Objects only — an array as `base` or `override` is not a case any caller has.
 */
export function deepMerge<T extends object>(base: T, override: object): T {
  const merged: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(base)) {
    merged[key] = cloneValue(value)
  }
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key]
    merged[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? deepMerge(existing, value)
        : cloneValue(value)
  }
  // `merged` already holds a cloned copy of every string key `base` has, so the
  // base spread is what keeps the result typed as `T` without a cast — the one
  // thing it contributes at runtime is any symbol key, which neither loop sees.
  return { ...base, ...merged }
}

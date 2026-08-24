// MIT https://github.com/inspect-js/is-object
export function isObject(
  x: unknown,
): x is Record<string | symbol | number, unknown> {
  return typeof x === 'object' && x !== null
}

// `isObject` minus arrays: the branch `deepEqual` and `deepMerge` recurse into
// key by key, as opposed to the one they walk by index.
export function isPlainObject(x: unknown): x is Record<string, unknown> {
  return isObject(x) && !Array.isArray(x)
}

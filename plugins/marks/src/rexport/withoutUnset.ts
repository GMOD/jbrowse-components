function isSet(value: unknown) {
  return !(
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  )
}

/**
 * A resolved config writes an unset slot as `''`, `[]` or `{}`, which a
 * translator reading `color.domain` or `facet` would take for a setting. Keeps
 * `false` and `0`, which are values.
 */
export function withoutUnset(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutUnset)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([k, v]) => [k, withoutUnset(v)] as const)
        .filter(([, v]) => isSet(v)),
    )
  }
  return value
}

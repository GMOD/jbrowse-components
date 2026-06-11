// Deterministic, locale-independent string ordering. Returns 0 when equal so
// it chains with `||` in multi-key comparators. Prefer this over
// `localeCompare` wherever the order must be reproducible across environments
// (e.g. sort keys feeding deterministic worker output or screenshot renders).
export function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

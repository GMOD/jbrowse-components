export function findNonSparseKeys(
  keys: readonly string[],
  rows: Record<string, unknown>[],
  cb: (row: Record<string, unknown>, f: string) => unknown,
) {
  return keys.filter(key => rows.filter(row => cb(row, key)).length > 5)
}

export function getRootKeys(obj: Record<string, unknown>) {
  return Object.entries(obj)
    .map(([key, val]) => (typeof val === 'string' ? key : ''))
    .filter((f): f is string => !!f)
}

export function findNonSparseKeys(
  keys: readonly string[],
  rows: Record<string, unknown>[],
  cb: (row: Record<string, unknown>, f: string) => unknown,
) {
  return keys.filter(f => rows.map(r => cb(r, f)).filter(f => !!f).length > 5)
}

export function getRootKeys(obj: Record<string, unknown>) {
  return Object.entries(obj)
    .map(([key, val]) => (typeof val === 'string' ? key : ''))
    .filter(f => !!f)
}

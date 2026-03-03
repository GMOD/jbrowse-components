export function findNonSparseKeys<T>(
  keys: readonly string[],
  rows: T[],
  cb: (row: T, f: string) => unknown,
  threshold = 5,
) {
  return keys.filter(key => {
    let count = 0
    for (const row of rows) {
      if (cb(row, key)) {
        count++
        if (count > threshold) {
          return true
        }
      }
    }
    return false
  })
}

export function getRootKeys(obj: Record<string, unknown>) {
  return Object.keys(obj).filter(key => {
    const val = obj[key]
    return val !== null && val !== undefined && typeof val !== 'object'
  })
}

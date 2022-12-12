type Hasher<T> = (input: T) => string

// from https://github.com/seriousManual/dedupe/blob/master/LICENSE
export function dedupe<T>(list: T[], hasher: Hasher<T> = JSON.stringify) {
  const clone: T[] = []
  const lookup: Record<string, boolean> = {}

  for (let i = 0; i < list.length; i++) {
    const entry = list[i]
    const hashed = hasher(entry)

    if (!lookup[hashed]) {
      clone.push(entry)
      lookup[hashed] = true
    }
  }

  return clone
}

type Hasher<T> = (input: T) => string

// from https://github.com/seriousManual/dedupe/blob/master/LICENSE
export function dedupe<T>(list: T[], hasher: Hasher<T> = JSON.stringify) {
  const clone: T[] = []
  const lookup = new Set<string>()

  for (let i = 0; i < list.length; i++) {
    const entry = list[i]
    const hashed = hasher(entry)

    if (!lookup.has(hashed)) {
      clone.push(entry)
      lookup.add(hashed)
    }
  }

  return clone
}

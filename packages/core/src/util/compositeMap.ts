// takes an array or Map or Set (anything iterable with values()) of Maps and
// lets you query them as one Map
export default class CompositeMap<T, U> {
  constructor(private submaps: Map<T, U>[]) {}

  has(id: T) {
    for (const submap of this.submaps.values()) {
      if (submap.has(id)) {
        return true
      }
    }
    return false
  }

  get(id: T) {
    for (const submap of this.submaps.values()) {
      if (submap.has(id)) {
        return submap.get(id)
      }
    }
    return undefined
  }

  *values() {
    const seen = new Set<T>()
    for (const submap of this.submaps.values()) {
      for (const [key, value] of submap) {
        if (!seen.has(key)) {
          seen.add(key)
          yield value
        }
      }
    }
  }

  *keys() {
    const seen = new Set<T>()
    for (const submap of this.submaps.values()) {
      for (const key of submap.keys()) {
        if (!seen.has(key)) {
          seen.add(key)
          yield key
        }
      }
    }
  }

  find<V>(f: (arg0: U) => V) {
    for (const submap of this.submaps.values()) {
      for (const value of submap.values()) {
        const found = f(value)
        if (found) {
          return value
        }
      }
    }
    return undefined
  }

  *[Symbol.iterator]() {
    yield* this.entries()
  }

  *entries() {
    const seen = new Set<T>()
    for (const submap of this.submaps.values()) {
      for (const [key, value] of submap) {
        if (!seen.has(key)) {
          seen.add(key)
          yield [key, value] as const
        }
      }
    }
  }
}

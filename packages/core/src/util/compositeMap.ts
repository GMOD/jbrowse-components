// takes an array or Map or Set (anything iterable with values()) of Maps and
// lets you query them as one Map
export default class CompositeMap<T, U> {
  constructor(private submaps: Map<T, U>[]) {}

  has(id: T) {
    for (const submap of this.submaps) {
      if (submap.has(id)) {
        return true
      }
    }
    return false
  }

  get(id: T) {
    for (const submap of this.submaps) {
      if (submap.has(id)) {
        return submap.get(id)
      }
    }
    return undefined
  }

  find(f: (arg0: U) => boolean): U | undefined {
    for (const submap of this.submaps) {
      for (const value of submap.values()) {
        if (f(value)) {
          return value
        }
      }
    }
    return undefined
  }

  *entries() {
    const seen = new Set<T>()
    for (const submap of this.submaps) {
      for (const [key, value] of submap) {
        if (!seen.has(key)) {
          seen.add(key)
          yield [key, value] as const
        }
      }
    }
  }

  *keys() {
    for (const [key] of this.entries()) {
      yield key
    }
  }

  *values() {
    for (const [, value] of this.entries()) {
      yield value
    }
  }

  *[Symbol.iterator]() {
    yield* this.entries()
  }
}

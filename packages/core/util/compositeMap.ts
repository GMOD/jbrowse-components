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
    for (const key of this.keys()) {
      yield this.get(key) as U
    }
  }

  *keys() {
    const keys = new Set<T>()
    for (const submap of this.submaps.values()) {
      for (const key of submap.keys()) {
        keys.add(key)
      }
    }
    for (const key of keys) {
      yield key
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
    for (const key of this.keys()) {
      yield [key, this.get(key)]
    }
  }

  *entries() {
    for (const k of this.keys()) {
      yield [k, this.get(k)]
    }
  }
}

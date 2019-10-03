// takes an array or Map or Set (anything iterable with values()) of Maps
// and lets you query them as one Map
export default class CompositeMap<T, U> {
  private submaps: Map<T, U>[]

  constructor(submaps: Map<T, U>[]) {
    this.submaps = submaps
  }

  has(id: T): boolean {
    for (const submap of this.submaps.values()) {
      if (submap.has(id)) return true
    }
    return false
  }

  get(id: T): U | undefined {
    for (const submap of this.submaps.values()) {
      if (submap.has(id)) return submap.get(id)
    }
    return undefined
  }

  *values(): Iterator<U> {
    for (const submap of this.submaps.values())
      for (const value of submap.values()) yield value
  }

  *[Symbol.iterator]() {
    for (const submap of this.submaps.values())
      for (const value of submap.entries()) yield value
  }
}

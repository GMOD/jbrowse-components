// takes an array or Map or Set (anything iterable with values()) of Maps
// and lets you query them as one Map
export default class CompositeMap {
  constructor(submaps) {
    this.submaps = submaps
  }

  has(id) {
    for (const submap of this.submaps.values()) {
      if (submap.has(id)) return true
    }
    return false
  }

  get(id) {
    for (const submap of this.submaps.values()) {
      if (submap.has(id)) return submap.get(id)
    }
    return undefined
  }

  *values() {
    for (const submap of this.submaps.values())
      for (const value of submap.values()) yield value
  }
}

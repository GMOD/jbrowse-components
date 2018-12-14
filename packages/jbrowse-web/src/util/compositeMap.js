// takes an Iterable (array or Map probably) of Maps
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
}

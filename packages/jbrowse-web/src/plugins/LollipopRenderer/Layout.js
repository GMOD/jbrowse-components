export class PrecomputedFloatingLayout {
  constructor({ pairs, totalHeight }) {
    this.layout = new Map(pairs)
    this.totalHeight = totalHeight
  }

  add(uniqueId) {
    if (!this.layout.has(uniqueId))
      throw new Error(`layout error, precomputed layout is missing ${uniqueId}`)
  }

  getLayout() {
    return this.layout
  }

  getTotalHeight() {
    return this.totalHeight
  }

  static fromJSON(json) {
    return new PrecomputedFloatingLayout(json)
  }
}

export class FloatingLayout {
  constructor({ width }) {
    if (!width) throw new Error('width required to make a new FloatingLayout')
    this.width = width
  }

  items = []

  add(uniqueId, anchorLocation, width, height, data) {
    this.items.push([uniqueId, anchorLocation, width, height, data])
  }

  /**
   * @returns {Map} of uniqueId => {x,y,anchorLocation,width,height,data}
   */
  getLayout() {
    return new Map(
      this.items.map(([uniqueId, anchorLocation, width, height, data]) => [
        uniqueId,
        { x: anchorLocation, y: 0, width, height, data },
      ]),
    )
  }

  getTotalHeight() {
    return 100
  }

  toJSON() {
    return { pairs: [...this.getLayout()], totalHeight: this.getTotalHeight() }
  }

  static fromJSON() {
    throw new Error('not supported')
  }
}

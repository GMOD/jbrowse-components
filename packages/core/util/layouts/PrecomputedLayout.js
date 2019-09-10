import { objectFromEntries } from '../index'

export default class PrecomputedLayout {
  constructor({ rectangles = {}, totalHeight = 0 }) {
    this.rectangles = new Map(Object.entries(rectangles))
    // rectangles is of the form "featureId": [leftPx, topPx, rightPx, bottomPx]
    this.totalHeight = totalHeight
  }

  addRect(id) {
    if (!this.rectangles.has(id)) {
      throw new Error(`id ${id} not found in precomputed feature layout`)
    }
    // left, top, right, bottom
    return this.rectangles.get(id)[1]
  }

  /**
   * returns a Map of feature id -> rectangle
   */
  getRectangles() {
    return this.rectangles
  }

  getTotalHeight() {
    return this.totalHeight
  }

  toJSON() {
    return {
      rectangles: objectFromEntries(this.rectangles),
      totalHeight: this.totalHeight,
    }
  }
}

export default class PrecomputedLayout {
  constructor({ rectangles, totalHeight }) {
    this.rectangles = rectangles // of the form "featureId": [leftPx, topPx, rightPx, bottomPx]
    this.totalHeight = totalHeight
  }

  addRect(id) {
    if (!(id in this.rectangles)) {
      // debugger
      throw new Error(`id ${id} not found in precomputed feature layout`)
    }
    // left, top, right, bottom
    return this.rectangles[id][1]
  }

  getRectangles() {
    return this.rectangles
  }

  toJSON() {
    return { rectangles: this.records, totalHeight: this.totalHeight }
  }
}

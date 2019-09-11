import { objectFromEntries } from '..'
import { RectTuple } from './BaseLayout'

export default class PrecomputedLayout {
  private rectangles: Map<string, RectTuple>

  private totalHeight: number

  constructor({ rectangles = {}, totalHeight = 0 }) {
    this.rectangles = new Map(Object.entries(rectangles))
    // rectangles is of the form "featureId": [leftPx, topPx, rightPx, bottomPx]
    this.totalHeight = totalHeight
  }

  addRect(id: string): number {
    const rect = this.rectangles.get(id)
    if (!rect) {
      throw new Error(`id ${id} not found in precomputed feature layout`)
    }
    // left, top, right, bottom
    return rect[1]
  }

  /**
   * returns a Map of feature id -> rectangle
   */
  getRectangles(): Map<string, RectTuple> {
    return this.rectangles
  }

  getTotalHeight(): number {
    return this.totalHeight
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): { rectangles: Record<string, any>; totalHeight: number } {
    return {
      rectangles: objectFromEntries(this.rectangles),
      totalHeight: this.totalHeight,
    }
  }
}

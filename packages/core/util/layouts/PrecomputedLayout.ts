import { objectFromEntries } from '..'
import {
  RectTuple,
  SerializedLayout,
  BaseLayout,
  Rectangle,
} from './BaseLayout'

export default class PrecomputedLayout<T> implements BaseLayout<T> {
  private rectangles: Map<string, RectTuple>

  private totalHeight: number

  constructor({ rectangles = {}, totalHeight = 0 }: SerializedLayout) {
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

  collides(rect: Rectangle<T>, top: number): boolean {
    throw new Error('Method not implemented.')
  }

  addRectToBitmap(rect: Rectangle<T>, data: Record<string, T>): void {
    throw new Error('Method not implemented.')
  }

  discardRange(left: number, right: number): void {
    throw new Error('Method not implemented.')
  }

  serializeRegion(region: { start: number; end: number }): SerializedLayout {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): SerializedLayout {
    return {
      rectangles: objectFromEntries(this.rectangles),
      totalHeight: this.totalHeight,
      maxHeightReached: false,
    }
  }
}

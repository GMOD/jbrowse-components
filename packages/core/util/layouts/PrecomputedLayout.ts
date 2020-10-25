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

  public maxHeightReached: boolean

  constructor({ rectangles, totalHeight, maxHeightReached }: SerializedLayout) {
    this.rectangles = new Map(Object.entries(rectangles))
    // rectangles is of the form "featureId": [leftPx, topPx, rightPx, bottomPx]
    this.totalHeight = totalHeight
    this.maxHeightReached = maxHeightReached
  }

  addRect(id: string) {
    const rect = this.rectangles.get(id)
    if (!rect) {
      throw new Error(`id ${id} not found in precomputed feature layout`)
    }
    // left, top, right, bottom
    return rect[1]
  }

  /**
   * returns a Map of `feature id -> rectangle`
   */
  getRectangles(): Map<string, RectTuple> {
    return this.rectangles
  }

  getTotalHeight(): number {
    return this.totalHeight
  }

  collides(_rect: Rectangle<T>, _top: number): boolean {
    throw new Error('Method not implemented.')
  }

  addRectToBitmap(_rect: Rectangle<T>, _data: Record<string, T>): void {
    throw new Error('Method not implemented.')
  }

  discardRange(_left: number, _right: number): void {
    throw new Error('Method not implemented.')
  }

  serializeRegion(_region: { start: number; end: number }): SerializedLayout {
    throw new Error('Method not implemented.')
  }

  toJSON(): SerializedLayout {
    return {
      rectangles: objectFromEntries(this.rectangles),
      totalHeight: this.totalHeight,
      maxHeightReached: false,
    }
  }
}

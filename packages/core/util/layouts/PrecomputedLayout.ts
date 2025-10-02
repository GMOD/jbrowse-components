import Flatbush from '../flatbush'

import type {
  BaseLayout,
  RectTuple,
  Rectangle,
  SerializedLayout,
} from './BaseLayout'

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}

export default class PrecomputedLayout<T> implements BaseLayout<T> {
  private rectangles: Map<string, RectTuple>

  private totalHeight: number

  public maxHeightReached: boolean

  private index?: Flatbush

  private indexData: { name: string; rect: RectTuple }[] = []

  constructor({ rectangles, totalHeight, maxHeightReached }: SerializedLayout) {
    this.rectangles = new Map(Object.entries(rectangles))
    // rectangles is of the form "featureId": [leftPx, topPx, rightPx, bottomPx]
    this.totalHeight = totalHeight
    this.maxHeightReached = maxHeightReached
    this.buildIndex()
  }

  private buildIndex() {
    if (this.rectangles.size === 0) {
      return
    }

    this.index = new Flatbush(this.rectangles.size)
    this.indexData = []

    for (const [name, rect] of this.rectangles) {
      this.index.add(rect[0], rect[1], rect[2], rect[3])
      this.indexData.push({ name, rect })
    }

    this.index.finish()
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

  getByCoord(x: number, y: number) {
    if (!this.index) {
      return undefined
    }

    const results = this.index.search(x, y, x + 1, y + 1)
    if (results.length > 0) {
      return this.indexData[results[0]!]?.name
    }

    return undefined
  }

  getByID(id: string) {
    return this.rectangles.get(id)
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
      rectangles: Object.fromEntries(this.rectangles),
      totalHeight: this.totalHeight,
      maxHeightReached: false,
      containsNoTransferables: true,
    }
  }
}

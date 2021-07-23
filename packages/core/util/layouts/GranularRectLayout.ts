import RBush from 'rbush'
import { objectFromEntries } from '../index'
import { RectTuple, SerializedLayout, BaseLayout } from './BaseLayout'

function segmentsIntersect(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
): boolean {
  return x2 >= y1 && y2 >= x1
}

export default class GranularRectLayout<T> implements BaseLayout<T> {
  private rectangles: Map<
    string,
    {
      minY: number
      maxY: number
      minX: number
      maxX: number
      id: string
    }
  >

  public maxHeightReached: boolean

  private maxHeight: number

  private rbush: RBush<{ id: string }>

  private pTotalHeight: number

  constructor({
    maxHeight = 10000,
  }: {
    maxHeight?: number
  } = {}) {
    this.maxHeightReached = false
    this.rbush = new RBush()
    this.rectangles = new Map()
    this.maxHeight = Math.ceil(maxHeight)
    this.pTotalHeight = 0 // total height, in units of bitmap squares (px/pitchY)
  }

  /**
   * @returns top position for the rect, or Null if laying
   *  out the rect would exceed maxHeight
   */
  addRect(
    id: string,
    left: number,
    right: number,
    height: number,
    data?: Record<string, T>,
  ): number | null {
    // add to rbush
    const existingRecord = this.rectangles.get(id)
    if (existingRecord) {
      return existingRecord.minY
    }

    let currHeight = 0
    let maxHeightReached = false
    while (
      this.rbush.collides({
        minX: left,
        minY: currHeight,
        maxX: right,
        maxY: currHeight + height,
      }) &&
      currHeight <= this.maxHeight
    ) {
      currHeight += 1
      if (currHeight + height >= this.maxHeight) {
        maxHeightReached = true
        break
      }
    }

    if (!maxHeightReached) {
      const record = {
        minX: left,
        minY: currHeight,
        maxX: right,
        maxY: currHeight + height,
        id,
        data,
      }
      this.rbush.insert(record)
      this.rectangles.set(id, record)
    }
    this.pTotalHeight = Math.min(
      this.maxHeight,
      Math.max(this.pTotalHeight, currHeight + height),
    )
    this.maxHeightReached = maxHeightReached
    return maxHeightReached ? null : currHeight
  }

  collides() {
    return false
  }

  /**
   *  Given a range of X coordinates, deletes all data dealing with
   *  the features.
   */
  discardRange(): void {}

  hasSeen(id: string): boolean {
    return this.rectangles.has(id)
  }

  getByCoord(x: number, y: number): Record<string, T> | string | undefined {
    const rect = { minX: x, minY: y, maxX: x + 1, maxY: y + 1 }
    return this.rbush.collides(rect) ? this.rbush.search(rect)[0].id : undefined
  }

  getByID(id: string): RectTuple | undefined {
    const rect = this.rectangles.get(id)
    if (rect) {
      const { minX, maxX, minY, maxY } = rect
      return [minX, minY, maxX, maxY]
    }

    return undefined
  }

  cleanup(): void {}

  getTotalHeight(): number {
    return this.pTotalHeight
  }

  get totalHeight() {
    return this.getTotalHeight()
  }

  serializeRegion(region: { start: number; end: number }): SerializedLayout {
    const regionRectangles: { [key: string]: RectTuple } = {}
    for (const [id, rect] of this.rectangles.entries()) {
      const { minX, maxX, minY, maxY } = rect
      const { start, end } = region
      if (segmentsIntersect(start, end, minX, maxX)) {
        regionRectangles[id] = [minX, minY, maxX, maxY]
      }
    }

    return {
      rectangles: regionRectangles,
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }

  getRectangles(): Map<string, RectTuple> {
    return new Map(
      [...this.rectangles.entries()].map(([id, { minX, minY, maxX, maxY }]) => [
        id,
        [minX, minY, maxX, maxY],
      ]),
    )
  }

  toJSON(): SerializedLayout {
    return {
      rectangles: objectFromEntries(this.getRectangles()),
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }
}

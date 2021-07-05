import { objectFromEntries } from '../index'
import RBush from 'rbush'
import {
  RectTuple,
  SerializedLayout,
  Rectangle,
  BaseLayout,
} from './BaseLayout'

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

  private rbush: RBush<any>

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
    while (
      this.rbush.collides({
        minX: left,
        minY: currHeight,
        maxX: right,
        maxY: currHeight + height,
      }) &&
      currHeight <= this.maxHeight
    ) {
      currHeight += 3
    }

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

    this.pTotalHeight = Math.max(this.pTotalHeight || 0, currHeight)
    return currHeight
  }

  collides(r: Rectangle<T>, top: number) {
    return false
  }

  /**
   *  Given a range of X coordinates, deletes all data dealing with
   *  the features.
   */
  discardRange(left: number, right: number): void {}

  hasSeen(id: string): boolean {
    return this.rectangles.has(id)
  }

  getByCoord(x: number, y: number): Record<string, T> | string | undefined {
    const rect = { minX: x, minY: y, maxX: x + 1, maxY: y + 1 }
    return this.rbush.collides(rect) ? this.rbush.search(rect)[0].name : []
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
    const maxHeightReached = false
    for (const [id, rect] of this.rectangles.entries()) {
      const { minX, maxX, minY, maxY } = rect
      // add +/- pitchX to avoid resolution causing errors
      if (segmentsIntersect(region.start, region.end, minX, maxX)) {
        regionRectangles[id] = [minX, minY, maxX, maxY]
      }
    }

    return {
      rectangles: regionRectangles,
      totalHeight: this.getTotalHeight(),
      maxHeightReached,
    }
  }

  getRectangles() {
    return {}
  }

  toJSON(): SerializedLayout {
    return {
      rectangles: {},
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }
}

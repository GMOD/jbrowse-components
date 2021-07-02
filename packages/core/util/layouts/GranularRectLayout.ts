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
  private hardRowLimit: number

  private rectangles: Map<
    string,
    Rectangle<{
      minY: number
      maxY: number
      minX: number
      maxX: number
      id: string
    }>
  >

  public maxHeightReached: boolean

  private maxHeight: number

  private displayMode: string

  private rbush: RBush<any>

  private pTotalHeight: number

  /*
   * maxHeight - maximum layout height, default Infinity (no max)
   */
  constructor({
    maxHeight = 10000,
    hardRowLimit = 3000,
    displayMode = 'normal',
  }: {
    maxHeight?: number
    displayMode?: string
    hardRowLimit?: number
  } = {}) {
    this.hardRowLimit = hardRowLimit
    this.maxHeightReached = false
    this.displayMode = displayMode
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
      currHeight += height
    }

    currHeight = currHeight

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
    const r = this.rectangles.get(id)
    if (r) {
      const t = r.top as number
      return [r.l, t, r.r, t + r.originalHeight]
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

  getRectangles(): Map<string, RectTuple> {
    return new Map(
      Array.from(this.rectangles.entries()).map(([id, rect]) => {
        const { l, r, originalHeight, top } = rect
        const t = top || 0
        const b = t + originalHeight
        return [id, [l, t, r, b]] // left, top, right, bottom
      }),
    )
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

  toJSON(): SerializedLayout {
    const rectangles = objectFromEntries(this.getRectangles())
    return {
      rectangles,
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }
}

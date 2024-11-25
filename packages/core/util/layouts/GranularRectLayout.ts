import type {
  RectTuple,
  SerializedLayout,
  Rectangle,
  BaseLayout,
} from './BaseLayout'

/**
 * Rectangle-layout manager that lays out rectangles using bitmaps at
 * resolution that, for efficiency, may be somewhat lower than that of
 * the coordinate system for the rectangles being laid out.  `pitchX`
 * and `pitchY` are the ratios of input scale resolution to internal
 * bitmap resolution.
 */

// minimum excess size of the array at which we garbage collect
const minSizeToBotherWith = 10000
const maxFeaturePitchWidth = 20000

function segmentsIntersect(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
): boolean {
  return x2 >= y1 && y2 >= x1
}

type Bit<T> = Record<string, T> | string | undefined

interface RowState<T> {
  min: number
  max: number
  offset: number
  bits: Bit<T>[]
}
// a single row in the layout
class LayoutRow<T> {
  private padding = 1

  private allFilled?: Record<string, T> | string

  private widthLimit = 1_000_000

  private rowState?: RowState<T>

  // this.rowState.bits is the array of items in the layout row, indexed by (x - this.offset)
  // this.rowState.min is the leftmost edge of all the rectangles we have in the layout
  // this.rowState.max is the rightmost edge of all the rectangles we have in the layout
  // this.rowState.offset is the offset of the bits array relative to the genomic coordinates
  //      (modified by pitchX, but we don't know that in this class)

  setAllFilled(data: Record<string, T> | string): void {
    this.allFilled = data
  }

  getItemAt(x: number): Record<string, T> | string | undefined {
    if (this.allFilled) {
      return this.allFilled
    }
    if (
      this.rowState?.min === undefined ||
      x < this.rowState.min ||
      x >= this.rowState.max
    ) {
      return undefined
    }
    return this.rowState.bits[x - this.rowState.offset]
  }

  isRangeClear(left: number, right: number) {
    if (this.allFilled) {
      return false
    }

    if (
      this.rowState === undefined ||
      right <= this.rowState.min ||
      left >= this.rowState.max
    ) {
      return true
    }
    const { min, max, offset, bits } = this.rowState

    const maxX = Math.min(max, right) - offset
    let flag = true
    for (let x = Math.max(min, left) - offset; x < maxX && flag; x++) {
      flag = bits[x] === undefined
    }

    return flag
  }

  // NOTE: this.rowState.min, this.rowState.max, and this.rowState.offset are
  // interbase coordinates
  initialize(left: number, right: number): RowState<T> {
    const rectWidth = right - left
    return {
      offset: left - rectWidth,
      min: left,
      max: right,
      bits: Array.from({ length: 3 * rectWidth }),
    }
  }

  addRect(rect: Rectangle<T>, data: Record<string, T> | string): void {
    const left = rect.l
    const right = rect.r + this.padding // only padding on the right
    if (!this.rowState) {
      this.rowState = this.initialize(left, right)
    }

    // or check if we need to expand to the left and/or to the right
    let oLeft = left - this.rowState.offset
    let oRight = right - this.rowState.offset
    const currLength = this.rowState.bits.length

    // expand rightward if necessary
    if (oRight >= this.rowState.bits.length) {
      const additionalLength = oRight + 1
      if (this.rowState.bits.length + additionalLength > this.widthLimit) {
        console.warn(
          'Layout width limit exceeded, discarding old layout. Please be more careful about discarding unused blocks.',
        )
        this.rowState = this.initialize(left, right)
      } else if (additionalLength > 0) {
        this.rowState.bits = [
          ...this.rowState.bits,
          ...Array.from<Bit<T>>({ length: additionalLength }),
        ]
      }
    }

    // expand leftward if necessary
    if (left < this.rowState.offset) {
      // use math.min to avoid negative lengths
      const additionalLength = Math.min(
        currLength - oLeft,
        this.rowState.offset,
      )
      if (this.rowState.bits.length + additionalLength > this.widthLimit) {
        console.warn(
          'Layout width limit exceeded, discarding old layout. Please be more careful about discarding unused blocks.',
        )

        this.rowState = this.initialize(left, right)
      } else {
        this.rowState.bits = [
          ...Array.from<Bit<T>>({ length: additionalLength }),
          ...this.rowState.bits,
        ]
        this.rowState.offset -= additionalLength
      }
    }
    oRight = right - this.rowState.offset
    oLeft = left - this.rowState.offset
    const w = oRight - oLeft

    if (w > maxFeaturePitchWidth) {
      console.warn(
        `Layout X pitch set too low, feature spans ${w} bits in a single row.`,
        rect,
        data,
      )
    }

    for (let x = oLeft; x < oRight; x += 1) {
      this.rowState.bits[x] = data
    }

    if (left < this.rowState.min) {
      this.rowState.min = left
    }
    if (right > this.rowState.max) {
      this.rowState.max = right
    }
  }

  /**
   *  Given a range of interbase coordinates, deletes all data dealing with that range
   */
  discardRange(left: number, right: number): void {
    if (this.allFilled) {
      return
    } // allFilled is irrevocable currently

    // if we have no data, do nothing
    if (!this.rowState) {
      return
    }

    // if doesn't overlap at all, do nothing
    if (right <= this.rowState.min || left >= this.rowState.max) {
      return
    }

    // if completely encloses range, discard everything
    if (left <= this.rowState.min && right >= this.rowState.max) {
      this.rowState = undefined
      return
    }

    // if overlaps left edge, adjust the min
    if (right > this.rowState.min && left <= this.rowState.min) {
      this.rowState.min = right
    }

    // if overlaps right edge, adjust the max
    if (left < this.rowState.max && right >= this.rowState.max) {
      this.rowState.max = left
    }

    // now trim the left, right, or both sides of the array
    if (
      this.rowState.offset < this.rowState.min - minSizeToBotherWith &&
      this.rowState.bits.length >
        this.rowState.max + minSizeToBotherWith - this.rowState.offset
    ) {
      // trim both sides
      const leftTrimAmount = this.rowState.min - this.rowState.offset
      const rightTrimAmount =
        this.rowState.bits.length -
        1 -
        (this.rowState.max - this.rowState.offset)
      // if (rightTrimAmount <= 0) debugger
      // if (leftTrimAmount <= 0) debugger
      // this.log(`trim both sides, ${leftTrimAmount} from left, ${rightTrimAmount} from right`)
      this.rowState.bits = this.rowState.bits.slice(
        leftTrimAmount,
        this.rowState.bits.length - rightTrimAmount,
      )
      this.rowState.offset += leftTrimAmount
      // if (this.rowState.offset > this.rowState.min) debugger
      // if (this.rowState.bits.length <= this.rowState.max - this.rowState.offset) debugger
    } else if (this.rowState.offset < this.rowState.min - minSizeToBotherWith) {
      // trim left side
      const desiredOffset =
        this.rowState.min - Math.floor(minSizeToBotherWith / 2)
      const trimAmount = desiredOffset - this.rowState.offset
      // this.log(`trim left side by ${trimAmount}`)
      this.rowState.bits.splice(0, trimAmount)
      this.rowState.offset += trimAmount
      // if (this.rowState.offset > this.rowState.min) debugger
      // if (this.rowState.bits.length <= this.rowState.max - this.rowState.offset) debugger
    } else if (
      this.rowState.bits.length >
      this.rowState.max - this.rowState.offset + minSizeToBotherWith
    ) {
      // trim right side
      const desiredLength =
        this.rowState.max -
        this.rowState.offset +
        1 +
        Math.floor(minSizeToBotherWith / 2)
      // this.log(`trim right side by ${this.rowState.bits.length-desiredLength}`)
      // if (desiredLength > this.rowState.bits.length) debugger
      this.rowState.bits.length = desiredLength
      // if (this.rowState.offset > this.rowState.min) debugger
      // if (this.rowState.bits.length <= this.rowState.max - this.rowState.offset) debugger
    }

    // if (this.rowState.offset > this.rowState.min) debugger
    // if (this.rowState.bits.length <= this.rowState.max - this.rowState.offset) debugger

    // if range now enclosed in the new bounds, loop through and clear the bits
    const oLeft = Math.max(this.rowState.min, left) - this.rowState.offset
    // if (oLeft < 0) debugger
    // if (oLeft >= this.rowState.bits.length) debugger
    // if (oRight < 0) debugger
    // if (oRight >= this.rowState.bits.length) debugger

    const oRight = Math.min(right, this.rowState.max) - this.rowState.offset
    for (let x = oLeft; x >= 0 && x < oRight; x += 1) {
      this.rowState.bits[x] = undefined
    }
  }
}

export default class GranularRectLayout<T> implements BaseLayout<T> {
  private pitchX: number

  private pitchY: number

  private hardRowLimit: number

  private bitmap: LayoutRow<T>[]

  private rectangles: Map<string, Rectangle<T>>

  public maxHeightReached: boolean

  private maxHeight: number

  private displayMode: string

  private pTotalHeight: number

  /**
   * pitchX - layout grid pitch in the X direction
   * pitchY - layout grid pitch in the Y direction
   * maxHeight - maximum layout height, default Infinity (no max)
   */
  constructor({
    pitchX = 10,
    pitchY = 10,
    maxHeight = 10000,
    hardRowLimit = 10000,
    displayMode = 'normal',
  }: {
    pitchX?: number
    pitchY?: number
    maxHeight?: number
    displayMode?: string
    hardRowLimit?: number
  } = {}) {
    this.pitchX = pitchX
    this.pitchY = pitchY
    this.hardRowLimit = hardRowLimit
    this.maxHeightReached = false
    this.displayMode = displayMode

    // reduce the pitchY to try and pack the features tighter
    if (this.displayMode === 'compact') {
      this.pitchY = Math.round(this.pitchY / 4) || 1
      this.pitchX = Math.round(this.pitchX / 4) || 1
    }

    this.bitmap = []
    this.rectangles = new Map()
    this.maxHeight = Math.ceil(maxHeight / this.pitchY)
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
    data?: T,
  ): number | null {
    // if we have already laid it out, return its layout
    const storedRec = this.rectangles.get(id)
    if (storedRec) {
      if (storedRec.top === null) {
        return null
      }

      // add it to the bitmap again, since that bitmap range may have been
      // discarded
      this.addRectToBitmap(storedRec)
      return storedRec.top * this.pitchY
    }

    const pLeft = Math.floor(left / this.pitchX)
    const pRight = Math.floor(right / this.pitchX)
    const pHeight = Math.ceil(height / this.pitchY)

    const rectangle: Rectangle<T> = {
      id,
      l: pLeft,
      r: pRight,
      top: null,
      h: pHeight,
      originalHeight: height,
      data,
    }

    const maxTop = this.maxHeight - pHeight
    let top = 0
    if (this.displayMode !== 'collapse') {
      for (; top <= maxTop; top += 1) {
        if (!this.collides(rectangle, top)) {
          break
        }
      }

      if (top > maxTop) {
        rectangle.top = null
        this.rectangles.set(id, rectangle)
        this.maxHeightReached = true
        return null
      }
    }
    rectangle.top = top
    this.addRectToBitmap(rectangle)
    this.rectangles.set(id, rectangle)
    this.pTotalHeight = Math.max(this.pTotalHeight || 0, top + pHeight)
    return top * this.pitchY
  }

  collides(rect: Rectangle<T>, top: number) {
    const { bitmap } = this

    const maxY = top + rect.h
    for (let y = top; y < maxY; y += 1) {
      const row = bitmap[y]
      if (row !== undefined && !row.isRangeClear(rect.l, rect.r)) {
        return true
      }
    }

    return false
  }

  /**
   * make a subarray if it does not exist
   */
  private autovivifyRow(bitmap: LayoutRow<T>[], y: number) {
    let row = bitmap[y]
    if (!row) {
      if (y > this.hardRowLimit) {
        throw new Error(
          `layout hard limit (${
            this.hardRowLimit * this.pitchY
          }px) exceeded, aborting layout`,
        )
      }
      row = new LayoutRow()
      bitmap[y] = row
    }
    return row
  }

  addRectToBitmap(rect: Rectangle<T>) {
    if (rect.top === null) {
      return
    }

    const data = rect.id
    const yEnd = rect.top + rect.h
    if (rect.r - rect.l > maxFeaturePitchWidth) {
      // the rect is very big in relation to the view size, just pretend, for
      // the purposes of layout, that it extends infinitely.  this will cause
      // weird layout if a user scrolls manually for a very, very long time
      // along the genome at the same zoom level.  but most users will not do
      // that.  hopefully.
      for (let y = rect.top; y < yEnd; y += 1) {
        this.autovivifyRow(this.bitmap, y).setAllFilled(data)
      }
    } else {
      for (let y = rect.top; y < yEnd; y += 1) {
        this.autovivifyRow(this.bitmap, y).addRect(rect, data)
      }
    }
  }

  /**
   *  Given a range of X coordinates, deletes all data dealing with
   *  the features.
   */
  discardRange(left: number, right: number) {
    const pLeft = Math.floor(left / this.pitchX)
    const pRight = Math.floor(right / this.pitchX)
    const { bitmap } = this
    for (const row of bitmap) {
      row.discardRange(pLeft, pRight)
    }
  }

  hasSeen(id: string) {
    return this.rectangles.has(id)
  }

  getByCoord(x: number, y: number) {
    const pY = Math.floor(y / this.pitchY)
    const row = this.bitmap[pY]
    if (!row) {
      return undefined
    }
    const pX = Math.floor(x / this.pitchX)
    return row.getItemAt(pX)
  }

  getByID(id: string) {
    const r = this.rectangles.get(id)
    if (r) {
      const t = r.top! * this.pitchY
      return [
        r.l * this.pitchX,
        t,
        r.r * this.pitchX,
        t + r.originalHeight,
      ] as RectTuple
    }

    return undefined
  }

  getDataByID(id: string) {
    return this.rectangles.get(id)?.data
  }

  cleanup() {}

  getTotalHeight() {
    return this.pTotalHeight * this.pitchY
  }

  get totalHeight() {
    return this.getTotalHeight()
  }

  getRectangles(): Map<string, RectTuple> {
    return new Map(
      [...this.rectangles.entries()].map(([id, rect]) => {
        const { l, r, originalHeight, top } = rect
        const t = (top || 0) * this.pitchY
        const b = t + originalHeight
        return [id, [l * this.pitchX, t, r * this.pitchX, b]] // left, top, right, bottom
      }),
    )
  }

  serializeRegion(region: { start: number; end: number }): SerializedLayout {
    const regionRectangles: Record<string, RectTuple> = {}
    let maxHeightReached = false
    for (const [id, rect] of this.rectangles.entries()) {
      const { l, r, originalHeight, top } = rect
      if (rect.top === null) {
        maxHeightReached = true
      } else {
        const t = (top || 0) * this.pitchY
        const b = t + originalHeight
        const y1 = l * this.pitchX
        const y2 = r * this.pitchX
        const x1 = region.start
        const x2 = region.end
        // add +/- pitchX to avoid resolution causing errors
        if (segmentsIntersect(x1, x2, y1 - this.pitchX, y2 + this.pitchX)) {
          regionRectangles[id] = [y1, t, y2, b]
        }
      }
    }
    return {
      rectangles: regionRectangles,
      containsNoTransferables: true,
      totalHeight: this.getTotalHeight(),
      maxHeightReached,
    }
  }

  toJSON(): SerializedLayout {
    const rectangles = Object.fromEntries(this.getRectangles())
    return {
      rectangles,
      containsNoTransferables: true,
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }
}

import { objectFromEntries } from '../index'
import {
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

interface RowState<T> {
  min: number
  max: number
  offset: number
  bits: (Record<string, T> | undefined)[]
}
// a single row in the layout
class LayoutRow<T> {
  private rowNumber: number

  private padding: number

  private allFilled?: Record<string, T>

  private widthLimit: number

  private rowState?: RowState<T>

  constructor(rowNumber: number) {
    this.rowNumber = rowNumber
    this.padding = 1
    this.widthLimit = 1000000

    // this.offset is the offset of the bits array relative to the genomic coordinates
    //      (modified by pitchX, but we don't know that in this class)
    // this.rowState.bits is the array of items in the layout row, indexed by (x - this.offset)
    // this.min is the leftmost edge of all the rectangles we have in the layout
    // this.max is the rightmost edge of all the rectangles we have in the layout
  }

  log(msg: string): void {
    // if (this.rowNumber === 0)
    // eslint-disable-next-line no-console
    console.log(`r${this.rowNumber}: ${msg}`)
  }

  setAllFilled(data: Record<string, T>): void {
    this.allFilled = data
  }

  getItemAt(x: number): Record<string, T> | undefined {
    if (this.allFilled) return this.allFilled
    if (!this.rowState) return undefined

    if (this.rowState.min === undefined) return undefined
    if (x < this.rowState.min) return undefined
    if (x >= this.rowState.max) return undefined
    const offset = x - this.rowState.offset
    // if (offset < 0)
    //     debugger
    // if (offset >= this.rowState.bits.length)
    //     debugger
    return this.rowState.bits[offset]
  }

  isRangeClear(left: number, right: number): boolean {
    if (this.allFilled) return false

    if (!this.rowState) return true

    const { min, max } = this.rowState

    if (right <= min || left >= max) return true

    // TODO: check right and middle before looping
    const maxX = Math.min(max, right)
    let x = Math.max(min, left)
    for (; x < right && x < maxX; x += 1) {
      if (this.getItemAt(x)) {
        return false
      }
    }

    return true
  }

  initialize(left: number, right: number): RowState<T> {
    // NOTE: this.rowState.min, this.rowState.max, and this.rowState.offset are interbase coordinates
    const rectWidth = right - left
    return {
      offset: left - rectWidth,
      min: left,
      max: right,
      bits: new Array(right - left + 2 * rectWidth),
    }
    // this.log(`initialize ${this.rowState.min} - ${this.rowState.max} (${this.rowState.bits.length})`)
  }

  addRect(rect: Rectangle<T>, data: Record<string, T>): void {
    const left = rect.l
    const right = rect.r + this.padding // only padding on the right
    if (!this.rowState) {
      this.rowState = this.initialize(left, right)
    }

    // or check if we need to expand to the left and/or to the right

    // expand rightward by the feature length + whole current length if necessary
    const currLength = this.rowState.bits.length

    if (right - this.rowState.offset >= this.rowState.bits.length) {
      const additionalLength =
        right -
        this.rowState.offset -
        this.rowState.bits.length +
        1 +
        this.rowState.bits.length
      if (this.rowState.bits.length + additionalLength > this.widthLimit) {
        console.warn(
          'Layout width limit exceeded, discarding old layout. Please be more careful about discarding unused blocks.',
        )
        this.initialize(left, right)
      } else if (additionalLength > 0) {
        this.rowState.bits = this.rowState.bits.concat(
          new Array(additionalLength),
        )
        // this.log(`expand right (${additionalLength}): ${this.rowState.offset} | ${
        // this.rowState.min} - ${this.rowState.max}`)
      }
    }

    // expand by 2x leftward if necessary
    if (left < this.rowState.offset) {
      const additionalLength = this.rowState.offset - left + currLength
      if (this.rowState.bits.length + additionalLength > this.widthLimit) {
        console.warn(
          'Layout width limit exceeded, discarding old layout. Please be more careful about discarding unused blocks.',
        )
        this.initialize(left, right)
      } else {
        this.rowState.bits = new Array(additionalLength).concat(
          this.rowState.bits,
        )
        this.rowState.offset -= additionalLength
        // this.log(`expand left (${additionalLength}): ${this.rowState.offset} | ${
        //   this.rowState.min} - ${this.rowState.max}`)
      }
    }

    // set the bits in the bitmask
    const oLeft = left - this.rowState.offset
    const oRight = right - this.rowState.offset
    // if (oLeft < 0) debugger
    // if (oRight < 0) debugger
    // if (oRight <= oLeft) debugger
    // if (oRight > this.rowState.bits.length) debugger
    if (oRight - oLeft > maxFeaturePitchWidth) {
      console.warn(
        `Layout X pitch set too low, feature spans ${oRight -
          oLeft} bits in a single row.`,
        rect,
        data,
      )
    }

    for (let x = oLeft; x < oRight; x += 1) {
      // if (this.rowState.bits[x] && this.rowState.bits[x].get('name') !== data.get('name')) debugger
      this.rowState.bits[x] = data
    }

    if (left < this.rowState.min) this.rowState.min = left
    if (right > this.rowState.max) this.rowState.max = right
    // // this.log(`added ${leftX} - ${rightX}`)
  }

  /**
   *  Given a range of interbase coordinates, deletes all data dealing with that range
   */
  discardRange(left: number, right: number): void {
    if (this.allFilled) return // allFilled is irrevocable currently

    // if we have no data, do nothing
    if (!this.rowState) return

    // if doesn't overlap at all, do nothing
    if (right <= this.rowState.min || left >= this.rowState.max) return

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
  /**
   * @param args.pitchX  layout grid pitch in the X direction
   * @param args.pitchY  layout grid pitch in the Y direction
   * @param args.maxHeight  maximum layout height, default Infinity (no max)
   */

  private id: string

  private pitchX: number

  private pitchY: number

  private hardRowLimit: number

  private bitmap: LayoutRow<T>[]

  private rectangles: Record<string, Rectangle<T>>

  private maxHeightReached: boolean

  private maxHeight: number

  private pTotalHeight: number

  constructor(args: {
    pitchX: number | undefined
    pitchY: number | undefined
    maxHeight: number | undefined
  }) {
    this.id = Math.random().toString(36)
    // console.log(`${this.id} constructed`)
    this.pitchX = args.pitchX || 10
    this.pitchY = args.pitchY || 10
    this.hardRowLimit = 3000
    this.maxHeightReached = false

    this.bitmap = []
    this.rectangles = {}
    this.maxHeight = Math.ceil((args.maxHeight || 10000) / this.pitchY)
    this.pTotalHeight = 0 // total height, in units of bitmap squares (px/pitchY)
  }

  /**
   * @returns {Number} top position for the rect, or Null if laying
   *  out the rect would exceed maxHeight
   */
  addRect(
    id: string,
    left: number,
    right: number,
    height: number,
    data: Record<string, T>,
  ): number | null {
    // if we have already laid it out, return its layout
    // console.log(`${this.id} add ${id}`)
    if (id in this.rectangles) {
      const storedRec = this.rectangles[id]
      if (storedRec.top === null) return null

      // add it to the bitmap again, since that bitmap range may have been discarded
      this.addRectToBitmap(storedRec, data)
      return storedRec.top * this.pitchY
    }

    const pLeft = Math.floor(left / this.pitchX)
    const pRight = Math.floor(right / this.pitchX)
    const pHeight = Math.ceil(height / this.pitchY)

    // const midX = Math.floor((pLeft + pRight) / 2)
    const rectangle: Rectangle<T> = {
      id,
      l: pLeft,
      r: pRight,
      top: null,
      // mX: midX,
      h: pHeight,
      originalHeight: height,
    }
    if (data) rectangle.data = data

    const maxTop = this.maxHeight - pHeight
    let top = 0
    for (; top <= maxTop; top += 1) {
      if (!this.collides(rectangle, top)) break
    }

    if (top > maxTop) {
      rectangle.top = null
      this.rectangles[id] = rectangle
      this.maxHeightReached = true
      return null
    }
    rectangle.top = top
    this.addRectToBitmap(rectangle, data)
    this.rectangles[id] = rectangle
    this.pTotalHeight = Math.max(this.pTotalHeight || 0, top + pHeight)
    // console.log(`G2 ${data.get('name')} ${top}`)
    return top * this.pitchY
  }

  collides(rect: Rectangle<T>, top: number): boolean {
    const { bitmap } = this
    // var mY = top + rect.h/2; // Y midpoint: ( top+height  + top ) / 2

    // test exhaustively
    const maxY = top + rect.h
    for (let y = top; y < maxY; y += 1) {
      const row = bitmap[y]
      if (row && !row.isRangeClear(rect.l, rect.r)) {
        return true
      }
    }

    return false
  }

  /**
   * make a subarray if it does not exist
   * @private
   */
  autovivifyRow = (bitmap: LayoutRow<T>[], y: number) => {
    let row = bitmap[y]
    if (!row) {
      if (y > this.hardRowLimit) {
        throw new Error(
          `layout hard limit (${this.hardRowLimit *
            this.pitchY}px) exceeded, aborting layout`,
        )
      }
      row = new LayoutRow(y)
      bitmap[y] = row
    }
    return row
  }

  addRectToBitmap(rect: Rectangle<T>, data: Record<string, T>): void {
    if (rect.top === null) return

    data = data || true
    const { bitmap } = this
    const av = this.autovivifyRow
    const yEnd = rect.top + rect.h
    if (rect.r - rect.l > maxFeaturePitchWidth) {
      // the rect is very big in relation to the view size, just
      // pretend, for the purposes of layout, that it extends
      // infinitely.  this will cause weird layout if a user
      // scrolls manually for a very, very long time along the
      // genome at the same zoom level.  but most users will not
      // do that.  hopefully.
      for (let y = rect.top; y < yEnd; y += 1) {
        av(bitmap, y).setAllFilled(data)
      }
    } else {
      for (let y = rect.top; y < yEnd; y += 1) {
        av(bitmap, y).addRect(rect, data)
      }
    }
  }

  /**
   *  Given a range of X coordinates, deletes all data dealing with
   *  the features.
   */
  discardRange(left: number, right: number): void {
    // console.log( 'discard', left, right );
    const pLeft = Math.floor(left / this.pitchX)
    const pRight = Math.floor(right / this.pitchX)
    const { bitmap } = this
    for (let y = 0; y < bitmap.length; y += 1) {
      const row = bitmap[y]
      if (row) row.discardRange(pLeft, pRight)
    }
  }

  hasSeen(id: string): boolean {
    return !!this.rectangles[id]
  }

  getByCoord(x: number, y: number): Record<string, T> | undefined {
    const pY = Math.floor(y / this.pitchY)
    const row = this.bitmap[pY]
    if (!row) return undefined
    const pX = Math.floor(x / this.pitchX)
    return row.getItemAt(pX)
  }

  getByID(id: string): (Record<string, T> | boolean) | undefined {
    const r = this.rectangles[id]
    if (r) {
      return r.data || true
    }
    return undefined
  }

  cleanup(): void {}

  getTotalHeight(): number {
    return this.pTotalHeight * this.pitchY
  }

  getRectangles(): Map<string, RectTuple> {
    return new Map(
      Object.entries(this.rectangles).map(([id, rect]) => {
        const { l, r, originalHeight, top } = rect
        const t = (top || 0) * this.pitchY
        const b = t + originalHeight
        return [id, [l * this.pitchX, t, r * this.pitchX, b]] // left, top, right, bottom
      }),
    )
  }

  serializeRegion(region: { start: number; end: number }): SerializedLayout {
    const regionRectangles: { [key: string]: RectTuple } = {}
    let maxHeightReached = false
    for (const iter of Object.entries(this.rectangles)) {
      const [id, rect] = iter
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
        if (segmentsIntersect(x1, x2, y1, y2)) {
          regionRectangles[id] = [y1, t, y2, b]
        }
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

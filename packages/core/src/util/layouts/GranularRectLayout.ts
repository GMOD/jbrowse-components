import {
  findInsertionPoint,
  insertInterval,
  isRangeClear as isRangeClearIntervals,
} from './intervalUtils.ts'

import type {
  BaseLayout,
  RectTuple,
  Rectangle,
  SerializedLayout,
} from './BaseLayout.ts'

/**
 * See https://github.com/cmdcolin/track_layout_benchmark for information on
 * alternative algorithms and benchmark information
 */

// a feature wider than this many pitch units is treated as filling its whole
// row(s), so layout doesn't track per-pixel intervals for it (see addRectToBitmap)
const maxFeaturePitchWidth = 20000

// Optimized row class using flat interval array. Holds only interval extents
// and feature ids, so it does not need the layout's data generic.
class LayoutRow {
  private padding = 1

  // The id of the feature filling the entire row (set for very wide features)
  public allFilled?: string

  // Flat array: [start1, end1, start2, end2, ...]
  // Kept sorted by start position for binary search
  private intervals: number[] = []

  // Parallel array storing the feature id for each interval
  private data: string[] = []

  setAllFilled(data: string): void {
    this.allFilled = data
  }

  getIntervals(): number[] {
    return this.intervals
  }

  getItemAt(x: number): string | undefined {
    if (this.allFilled) {
      return this.allFilled
    }

    const intervals = this.intervals
    const len = intervals.length

    if (len === 0) {
      return undefined
    }

    // Linear scan for small arrays
    if (len < 40) {
      for (let i = 0; i < len; i += 2) {
        if (x >= intervals[i]! && x < intervals[i + 1]!) {
          return this.data[i >> 1]
        }
      }
      return undefined
    }

    // Binary search for larger arrays - find interval containing x
    let low = 0
    let high = len >> 1

    while (low < high) {
      const mid = (low + high) >>> 1
      const midIdx = mid << 1
      if (intervals[midIdx + 1]! <= x) {
        low = mid + 1
      } else {
        high = mid
      }
    }

    const idx = low << 1
    if (idx < len && x >= intervals[idx]! && x < intervals[idx + 1]!) {
      return this.data[low]
    }
    return undefined
  }

  isRangeClear(left: number, right: number): boolean {
    return !this.allFilled && isRangeClearIntervals(this.intervals, left, right)
  }

  addRect(rect: { l: number; r: number }, data: string): void {
    const left = rect.l
    const right = rect.r + this.padding
    const intervals = this.intervals
    const len = intervals.length

    // Fast path: features usually arrive sorted, so append to the end
    if (len === 0 || left >= intervals[len - 2]!) {
      intervals.push(left, right)
      this.data.push(data)
    } else {
      const idx = findInsertionPoint(intervals, left)
      insertInterval(intervals, idx, left, right)
      this.data.splice(idx >> 1, 0, data)
    }
  }

  discardRange(left: number, right: number): void {
    if (this.allFilled) {
      return
    }

    const intervals = this.intervals
    const data = this.data
    const oldLen = intervals.length
    const newIntervals: number[] = []
    const newData: string[] = []

    for (let i = 0; i < oldLen; i += 2) {
      const start = intervals[i]!
      const end = intervals[i + 1]!
      const intervalData = data[i >> 1]!

      // If interval is completely within discard range, skip it
      if (start >= left && end <= right) {
        continue
      }
      // If no overlap, keep it
      if (end <= left || start >= right) {
        newIntervals.push(start, end)
        newData.push(intervalData)
      }
      // If interval overlaps left edge
      else if (start < left && end > left) {
        if (end <= right) {
          // Trim from the right
          newIntervals.push(start, left)
          newData.push(intervalData)
        } else {
          // Interval spans the entire discard range, split it
          newIntervals.push(start, left, right, end)
          newData.push(intervalData, intervalData)
        }
      }
      // If interval overlaps right edge only
      else if (start < right && end > right) {
        newIntervals.push(right, end)
        newData.push(intervalData)
      }
    }

    this.intervals = newIntervals
    this.data = newData
  }
}

export default class GranularRectLayout<T> implements BaseLayout<T> {
  private pitchX: number

  private pitchY: number

  private hardRowLimit: number

  // sparse: rows are created lazily as rects land on them and first-fit scans
  // rows beyond the highest created one, so every access must guard for undefined
  private bitmap: (LayoutRow | undefined)[]

  private rectangles: Map<string, Rectangle<T>>

  public maxHeightReached: boolean

  private maxHeight: number

  private displayMode: string

  private pTotalHeight: number

  /**
   * pitchX - layout grid pitch in the X direction
   * pitchY - layout grid pitch in the Y direction
   * maxHeight - maximum layout height in pixels, default 10000
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
    serializableData?: T,
  ): number | null {
    const pitchX = this.pitchX
    const pitchY = this.pitchY

    // if we have already laid it out, return its layout
    const storedRec = this.rectangles.get(id)
    if (storedRec) {
      // Update serializableData even if rect already exists
      // This is needed when config changes (e.g., showSubfeatureLabels toggle)
      // cause the same rect to be added with different metadata
      if (serializableData !== undefined) {
        storedRec.serializableData = serializableData
      }

      if (storedRec.top === null) {
        return null
      }

      // add it to the bitmap again, since that bitmap range may have been
      // discarded
      this.addRectToBitmap(storedRec)
      return storedRec.top * pitchY
    }

    // Use Math.trunc for fast floor operation that works with large coordinates
    // (bitwise | 0 overflows above 2^31, causing layout issues with large genomic coordinates)
    const pLeft = Math.trunc(left / pitchX)
    const pRight = Math.trunc(right / pitchX)
    const pHeight = Math.ceil(height / pitchY)

    const rectangle: Rectangle<T> = {
      id,
      l: pLeft,
      r: pRight,
      top: null,
      h: pHeight,
      originalHeight: height,
      data,
      serializableData,
    }

    // Allow features to start at any position up to maxHeight
    // Features starting at maxHeight or beyond are filtered out, but features
    // that start below maxHeight and extend past it are allowed
    const maxTop = this.maxHeight
    let top = 0

    if (this.displayMode !== 'collapse') {
      // OPTIMIZATION: Inline collision checking for hot path
      // Eliminates function call overhead which is critical at 100k+ features
      const bitmap = this.bitmap

      outer: for (; top <= maxTop; top += 1) {
        // Check all rows that this rectangle would occupy
        const maxY = top + pHeight
        for (let y = top; y < maxY; y += 1) {
          const row = bitmap[y]

          // Fast path: no row created yet
          if (!row) {
            continue
          }

          // Fast path: row is all filled
          if (row.allFilled) {
            continue outer
          }

          // Fully inlined isRangeClear for maximum performance
          const intervals = row.getIntervals()
          const len = intervals.length

          if (len > 0) {
            if (len < 40) {
              // Linear scan for small arrays
              for (let i = 0; i < len; i += 2) {
                const start = intervals[i]!
                const end = intervals[i + 1]!
                if (end > pLeft && start < pRight) {
                  continue outer
                }
              }
            } else {
              // Binary search for larger arrays
              let low = 0
              let high = len >> 1

              while (low < high) {
                const mid = (low + high) >>> 1
                const midIdx = mid << 1
                if (intervals[midIdx + 1]! <= pLeft) {
                  low = mid + 1
                } else {
                  high = mid
                }
              }

              const idx = low << 1
              if (idx < len) {
                const start = intervals[idx]!
                if (start < pRight) {
                  continue outer
                }
              }
            }
          }
        }

        // No collision found in any row
        break
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
    this.pTotalHeight = Math.max(this.pTotalHeight, top + pHeight)
    return top * pitchY
  }

  collides(rect: Rectangle<T>, top: number) {
    const maxY = top + rect.h
    for (let y = top; y < maxY; y += 1) {
      const row = this.bitmap[y]
      if (row !== undefined && !row.isRangeClear(rect.l, rect.r)) {
        return true
      }
    }
    return false
  }

  private getOrCreateRow(y: number): LayoutRow {
    let row = this.bitmap[y]
    if (!row) {
      if (y > this.hardRowLimit) {
        throw new Error(
          `layout hard limit (${this.hardRowLimit * this.pitchY}px) exceeded, aborting layout`,
        )
      }
      row = new LayoutRow()
      this.bitmap[y] = row
    }
    return row
  }

  addRectToBitmap(rect: Rectangle<T>) {
    if (rect.top === null) {
      return
    }

    const data = rect.id
    const yEnd = rect.top + rect.h

    // A rect very big in relation to the view size just pretends, for the
    // purposes of layout, that it extends infinitely. This causes weird layout
    // if a user scrolls manually for a very, very long time along the genome at
    // the same zoom level, but most users will not do that. hopefully.
    const fillsRow = rect.r - rect.l > maxFeaturePitchWidth

    for (let y = rect.top; y < yEnd; y += 1) {
      const row = this.getOrCreateRow(y)
      if (fillsRow) {
        row.setAllFilled(data)
      } else {
        row.addRect(rect, data)
      }
    }
  }

  /**
   *  Given a range of X coordinates, deletes all data dealing with
   *  the features.
   */
  discardRange(left: number, right: number) {
    const pLeft = Math.trunc(left / this.pitchX)
    const pRight = Math.trunc(right / this.pitchX)
    const { bitmap } = this
    // bitmap can be sparse: rows are created lazily, so guard for undefined
    for (const row of bitmap) {
      if (row) {
        row.discardRange(pLeft, pRight)
      }
    }
  }

  hasSeen(id: string) {
    return this.rectangles.has(id)
  }

  getByCoord(x: number, y: number) {
    const pY = Math.trunc(y / this.pitchY)
    const row = this.bitmap[pY]
    if (!row) {
      return undefined
    }
    const pX = Math.trunc(x / this.pitchX)
    return row.getItemAt(pX)
  }

  getByID(id: string) {
    const r = this.rectangles.get(id)
    // top === null means the feature overflowed maxHeight and was never placed
    if (r && r.top !== null) {
      const t = r.top * this.pitchY
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

  getSerializableDataByID(id: string) {
    return this.rectangles.get(id)?.serializableData
  }

  getTotalHeight() {
    return this.pTotalHeight * this.pitchY
  }

  get totalHeight() {
    return this.getTotalHeight()
  }

  getRectangles(): Map<string, RectTuple> {
    const pitchX = this.pitchX
    const pitchY = this.pitchY
    return new Map(
      [...this.rectangles.entries()].map(([id, rect]) => {
        const { l, r, originalHeight, top, serializableData } = rect
        const t = (top ?? 0) * pitchY
        const b = t + originalHeight
        return [id, [l * pitchX, t, r * pitchX, b, serializableData]] // left, top, right, bottom
      }),
    )
  }

  serializeRegion(region: { start: number; end: number }): SerializedLayout {
    const pitchX = this.pitchX
    const pitchY = this.pitchY
    const x1 = region.start
    const x2 = region.end
    const regionRectangles: Record<string, RectTuple> = {}
    let maxHeightReached = false

    for (const [id, rect] of this.rectangles.entries()) {
      const { l, r, originalHeight, top } = rect
      if (top === null) {
        maxHeightReached = true
      } else {
        const t = top * pitchY
        const b = t + originalHeight
        const y1 = l * pitchX
        const y2 = r * pitchX
        // add +/- pitchX to avoid resolution causing errors
        if (x2 >= y1 - pitchX && y2 + pitchX >= x1) {
          regionRectangles[id] = [y1, t, y2, b, rect.serializableData]
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
    const rectangles = Object.fromEntries(this.getRectangles())
    return {
      rectangles,
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }
}

import type {
  BaseLayout,
  RectTuple,
  Rectangle,
  SerializedLayout,
} from './BaseLayout'

/**
 * See https://github.com/cmdcolin/track_layout_benchmark for information on
 * alternative algorithms and benchmark information
 */

// minimum excess size of the array at which we garbage collect
const maxFeaturePitchWidth = 20000

// Optimized row class using flat interval array
class LayoutRow<T> {
  private padding = 1

  public allFilled?: Record<string, T> | string

  // Flat array: [start1, end1, start2, end2, ...]
  // Kept sorted by start position for binary search
  private intervals: number[] = []

  // Parallel array storing data for each interval
  private data: (Record<string, T> | string)[] = []

  setAllFilled(data: Record<string, T> | string): void {
    this.allFilled = data
  }

  getIntervals(): number[] {
    return this.intervals
  }

  getItemAt(x: number): Record<string, T> | string | undefined {
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
    if (this.allFilled) {
      return false
    }

    const intervals = this.intervals
    const len = intervals.length

    // Empty row is always clear
    if (len === 0) {
      return true
    }

    // Linear scan for small arrays (better cache locality)
    if (len < 40) {
      for (let i = 0; i < len; i += 2) {
        const start = intervals[i]!
        const end = intervals[i + 1]!
        // Intersection check: end > left && start < right
        if (end > left && start < right) {
          return false
        }
      }
      return true
    }

    // Binary search for larger arrays
    // Find first interval whose end > left (first potential overlap)
    let low = 0
    let high = len >> 1

    while (low < high) {
      const mid = (low + high) >>> 1
      const midIdx = mid << 1
      if (intervals[midIdx + 1]! <= left) {
        low = mid + 1
      } else {
        high = mid
      }
    }

    // Check if found interval overlaps
    const idx = low << 1
    if (idx >= len) {
      return true
    }

    // If the first candidate's start is >= right, no overlap possible
    const start = intervals[idx]!
    if (start >= right) {
      return true
    }

    // This interval overlaps (we know end > left from binary search, and start < right)
    return false
  }

  addRect(rect: Rectangle<T>, data: Record<string, T> | string): void {
    const left = rect.l
    const right = rect.r + this.padding
    const intervals = this.intervals
    const len = intervals.length

    // Hybrid insertion strategy
    if (len < 40) {
      // Linear insertion for small arrays
      let idx = len
      for (let i = 0; i < len; i += 2) {
        if (left < intervals[i]!) {
          idx = i
          break
        }
      }
      intervals.splice(idx, 0, left, right)
      this.data.splice(idx >> 1, 0, data)
    } else {
      // Binary search insertion for larger arrays
      let low = 0
      let high = len >> 1

      while (low < high) {
        const mid = (low + high) >>> 1
        const midIdx = mid << 1
        if (intervals[midIdx]! < left) {
          low = mid + 1
        } else {
          high = mid
        }
      }

      intervals.splice(low << 1, 0, left, right)
      this.data.splice(low, 0, data)
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
    const newData: (Record<string, T> | string)[] = []

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
      dataRef: data ? new WeakRef(data) : undefined,
      serializableData,
    }

    const maxTop = this.maxHeight - pHeight
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
    this.pTotalHeight = Math.max(this.pTotalHeight || 0, top + pHeight)
    return top * pitchY
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

  addRectToBitmap(rect: Rectangle<T>) {
    if (rect.top === null) {
      return
    }

    const data = rect.id
    const yEnd = rect.top + rect.h
    const bitmap = this.bitmap
    const hardRowLimit = this.hardRowLimit
    const pitchY = this.pitchY

    if (rect.r - rect.l > maxFeaturePitchWidth) {
      // the rect is very big in relation to the view size, just pretend, for
      // the purposes of layout, that it extends infinitely.  this will cause
      // weird layout if a user scrolls manually for a very, very long time
      // along the genome at the same zoom level.  but most users will not do
      // that.  hopefully.
      for (let y = rect.top; y < yEnd; y += 1) {
        let row = bitmap[y]
        if (!row) {
          if (y > hardRowLimit) {
            throw new Error(
              `layout hard limit (${hardRowLimit * pitchY}px) exceeded, aborting layout`,
            )
          }
          row = new LayoutRow()
          bitmap[y] = row
        }
        row.setAllFilled(data)
      }
    } else {
      for (let y = rect.top; y < yEnd; y += 1) {
        let row = bitmap[y]
        if (!row) {
          if (y > hardRowLimit) {
            throw new Error(
              `layout hard limit (${hardRowLimit * pitchY}px) exceeded, aborting layout`,
            )
          }
          row = new LayoutRow()
          bitmap[y] = row
        }
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
    for (const row of bitmap) {
      row.discardRange(pLeft, pRight)
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
    return this.rectangles.get(id)?.dataRef?.deref()
  }

  cleanup() {}

  getTotalHeight() {
    return this.pTotalHeight * this.pitchY
  }

  get totalHeight() {
    return this.getTotalHeight()
  }

  getRectangles(): Map<string, RectTuple> {
    const pitchX = this.pitchX
    const pitchY = this.pitchY
    // @ts-expect-error
    return new Map(
      [...this.rectangles.entries()].map(([id, rect]) => {
        const { l, r, originalHeight, top, serializableData } = rect
        const t = (top || 0) * pitchY
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
          // @ts-expect-error
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

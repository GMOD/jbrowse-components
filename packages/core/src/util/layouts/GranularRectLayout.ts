import { findInsertionPoint, insertInterval } from './intervalUtils.ts'

/**
 * See https://github.com/cmdcolin/track_layout_benchmark for information on
 * alternative algorithms and benchmark information
 */

// One row's occupied spans, as a flat [start1, end1, start2, end2, ...] array
// kept sorted by start. Spans within a row never overlap, which is what lets
// the collision scan binary-search it.
class LayoutRow {
  private padding = 1

  private intervals: number[] = []

  getIntervals(): number[] {
    return this.intervals
  }

  addRect(rect: { l: number; r: number }): void {
    const left = rect.l
    const right = rect.r + this.padding
    const intervals = this.intervals
    const len = intervals.length

    // Fast path: features usually arrive sorted, so append to the end
    if (len === 0 || left >= intervals[len - 2]!) {
      intervals.push(left, right)
    } else {
      insertInterval(
        intervals,
        findInsertionPoint(intervals, left),
        left,
        right,
      )
    }
  }
}

// A rect the layout has placed, in pitch units. `top` is null for one that
// overflowed maxHeight and so never reached a row.
interface Rectangle {
  l: number
  r: number
  top: number | null
  h: number
}

export default class GranularRectLayout {
  private pitchX: number

  private pitchY: number

  private hardRowLimit: number

  // sparse: rows are created lazily as rects land on them and first-fit scans
  // rows beyond the highest created one, so every access must guard for undefined
  private bitmap: (LayoutRow | undefined)[]

  private rectangles: Map<string, Rectangle>

  private maxHeight: number

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
  }: {
    pitchX?: number
    pitchY?: number
    maxHeight?: number
    hardRowLimit?: number
  } = {}) {
    this.pitchX = pitchX
    this.pitchY = pitchY
    this.hardRowLimit = hardRowLimit

    this.bitmap = []
    this.rectangles = new Map()
    this.maxHeight = Math.ceil(maxHeight / this.pitchY)
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
  ): number | null {
    const pitchX = this.pitchX
    const pitchY = this.pitchY

    // if we have already laid it out, return its layout
    const storedRec = this.rectangles.get(id)
    if (storedRec) {
      return storedRec.top === null ? null : storedRec.top * pitchY
    }

    // Use Math.trunc for fast floor operation that works with large coordinates
    // (bitwise | 0 overflows above 2^31, causing layout issues with large genomic coordinates)
    const pLeft = Math.trunc(left / pitchX)
    const pRight = Math.trunc(right / pitchX)
    const pHeight = Math.ceil(height / pitchY)

    const rectangle: Rectangle = {
      l: pLeft,
      r: pRight,
      top: null,
      h: pHeight,
    }

    // Allow features to start at any position up to maxHeight
    // Features starting at maxHeight or beyond are filtered out, but features
    // that start below maxHeight and extend past it are allowed
    const maxTop = this.maxHeight
    let top = 0

    // OPTIMIZATION: Inline collision checking for hot path
    // Eliminates function call overhead which is critical at 100k+ features
    const bitmap = this.bitmap

    // On a collision at row y, the next top worth trying is y + 1, not top + 1.
    // Rows top..y-1 are clear (y is the first hit walking upward) and every top'
    // between them still spans y, because y < top + pHeight — so nothing between
    // can fit. `top = y` plus the loop's own increment is that jump, and it turns
    // the scan from O(rows * pHeight) into O(rows): without it, a rect pHeight
    // rows tall re-tests the row that blocked it pHeight times over.
    outer: for (; top <= maxTop; top += 1) {
      // Check all rows that this rectangle would occupy
      const maxY = top + pHeight
      for (let y = top; y < maxY; y += 1) {
        const row = bitmap[y]

        // Fast path: no row created yet
        if (!row) {
          continue
        }

        const intervals = row.getIntervals()
        const len = intervals.length

        if (len > 0) {
          if (len < 40) {
            // Linear scan for small arrays
            for (let i = 0; i < len; i += 2) {
              const start = intervals[i]!
              const end = intervals[i + 1]!
              if (end > pLeft && start < pRight) {
                top = y
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
                top = y
                continue outer
              }
            }
          }
        }
      }

      // No collision found in any row
      break
    }

    this.rectangles.set(id, rectangle)
    if (top > maxTop) {
      return null
    }

    rectangle.top = top
    const yEnd = top + pHeight
    for (let y = top; y < yEnd; y += 1) {
      this.getOrCreateRow(y).addRect(rectangle)
    }
    return top * pitchY
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
}

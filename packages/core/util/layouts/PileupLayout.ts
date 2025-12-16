import {
  findInsertionPoint,
  insertInterval,
  isRangeClear,
} from './intervalUtils'

import type {
  BaseLayout,
  RectTuple,
  Rectangle,
  SerializedLayout,
} from './BaseLayout'

/**
 * Specialized layout for pileup displays where all features have uniform height.
 *
 * Advantages over GranularRectLayout:
 * - Simpler: no multi-row collision checks (each feature = one row)
 * - Explicit spacing parameter instead of pitchY hack
 * - Built-in hint optimization for same-start features
 * - Returns pixel positions directly
 */

export interface PileupLayoutOptions {
  /** Height of each feature in pixels */
  featureHeight?: number
  /** Spacing between features in pixels (default 0) */
  spacing?: number
  /** Maximum layout height in pixels */
  maxHeight?: number
}

export interface PileupRectangle {
  id: string
  left: number
  right: number
  top: number
}

export default class PileupLayout<T> implements BaseLayout<T> {
  private featureHeight: number
  private spacing: number
  private rowHeight: number
  private maxRows: number
  private rows: number[][] = [] // Each row is a flat interval array [start1, end1, start2, end2, ...]
  private rowMaxEnd: number[] = [] // Track rightmost end per row for O(1) check
  private rectangles = new Map<string, Rectangle<T>>()

  // For hint optimization: track last placed feature
  private lastLeft = -Infinity
  private lastRow = 0

  public maxHeightReached = false

  constructor(options: PileupLayoutOptions = {}) {
    this.featureHeight = options.featureHeight ?? 7
    this.spacing = options.spacing ?? 0
    this.rowHeight = this.featureHeight + this.spacing
    this.maxRows = options.maxHeight
      ? Math.floor(options.maxHeight / this.rowHeight)
      : 100000
  }

  addRect(
    id: string,
    left: number,
    right: number,
    height: number,
    data?: T,
    serializableData?: T,
  ): number | null {
    // Check if already laid out
    const existing = this.rectangles.get(id)
    if (existing) {
      if (existing.top === null) {
        return null
      }
      return existing.top * this.rowHeight
    }

    // Use hint: if same start as previous feature, start searching from next row
    let startRow = 0
    if (left === this.lastLeft) {
      startRow = this.lastRow + 1
    }

    // Find first row where this feature fits
    const row = this.findFreeRow(left, right, startRow)
    if (row === null) {
      const rect: Rectangle<T> = {
        id,
        l: left,
        r: right,
        top: null,
        h: 1,
        originalHeight: this.featureHeight,
        data,
        serializableData,
      }
      this.rectangles.set(id, rect)
      this.maxHeightReached = true
      return null
    }

    // Add to row
    this.addToRow(row, left, right)

    // Store rectangle
    const rect: Rectangle<T> = {
      id,
      l: left,
      r: right,
      top: row,
      h: 1,
      originalHeight: this.featureHeight,
      data,
      serializableData,
    }
    this.rectangles.set(id, rect)

    // Update hint state
    this.lastLeft = left
    this.lastRow = row

    return row * this.rowHeight
  }

  private findFreeRow(
    left: number,
    right: number,
    startRow: number,
  ): number | null {
    const rows = this.rows
    const rowMaxEnd = this.rowMaxEnd
    for (let row = startRow; row < this.maxRows; row++) {
      const intervals = rows[row]

      // Empty row - it's free
      if (!intervals) {
        return row
      }

      // Fast path: if left >= max end of row, it's clear
      if (left >= rowMaxEnd[row]!) {
        return row
      }

      // Check if range is clear in this row
      if (isRangeClear(intervals, left, right)) {
        return row
      }
    }
    return null
  }

  private addToRow(rowIdx: number, left: number, right: number): void {
    let intervals = this.rows[rowIdx]
    if (!intervals) {
      intervals = []
      this.rows[rowIdx] = intervals
      this.rowMaxEnd[rowIdx] = 0
    }

    const len = intervals.length

    // Fast path: append to end (common case when sorted by start)
    if (len === 0 || left >= intervals[len - 2]!) {
      intervals.push(left, right)
    } else {
      const idx = findInsertionPoint(intervals, left)
      insertInterval(intervals, idx, left, right)
    }

    // Update rowMaxEnd
    if (right > this.rowMaxEnd[rowIdx]!) {
      this.rowMaxEnd[rowIdx] = right
    }
  }

  collides(_rect: Rectangle<T>, _top: number): boolean {
    // Not used in pileup - features are always single-row
    return false
  }

  addRectToBitmap(_rect: Rectangle<T>): void {
    // Not needed - we add to bitmap during addRect
  }

  getTotalHeight(): number {
    let maxRow = 0
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i]) {
        maxRow = i + 1
        break
      }
    }
    return maxRow * this.rowHeight
  }

  getRectangles(): Map<string, RectTuple> {
    const result = new Map<string, RectTuple>()
    const rowHeight = this.rowHeight
    const featureHeight = this.featureHeight
    for (const [id, rect] of this.rectangles) {
      if (rect.top !== null) {
        const top = rect.top * rowHeight
        result.set(id, [rect.l, top, rect.r, top + featureHeight])
      }
    }
    return result
  }

  discardRange(left: number, right: number): void {
    for (let rowIdx = 0; rowIdx < this.rows.length; rowIdx++) {
      const intervals = this.rows[rowIdx]
      if (!intervals) {
        continue
      }

      const newIntervals: number[] = []
      let maxEnd = 0

      for (let i = 0; i < intervals.length; i += 2) {
        const start = intervals[i]!
        const end = intervals[i + 1]!

        if (end <= left || start >= right) {
          newIntervals.push(start, end)
          if (end > maxEnd) {
            maxEnd = end
          }
        } else if (start < left && end > left && end <= right) {
          newIntervals.push(start, left)
          if (left > maxEnd) {
            maxEnd = left
          }
        } else if (start >= left && start < right && end > right) {
          newIntervals.push(right, end)
          if (end > maxEnd) {
            maxEnd = end
          }
        } else if (start < left && end > right) {
          newIntervals.push(start, left, right, end)
          if (end > maxEnd) {
            maxEnd = end
          }
        }
      }

      this.rows[rowIdx] = newIntervals
      this.rowMaxEnd[rowIdx] = maxEnd
    }

    // Reset hint when discarding
    this.lastLeft = -Infinity
    this.lastRow = 0
  }

  getDataByID(id: string) {
    return this.rectangles.get(id)?.data
  }

  serializeRegion(region: { start: number; end: number }): SerializedLayout {
    const { start: x1, end: x2 } = region
    const regionRectangles: Record<string, RectTuple> = {}

    for (const [id, rect] of this.rectangles.entries()) {
      if (rect.top === null) {
        continue
      }
      const { l, r, top } = rect
      if (x2 >= l && r >= x1) {
        const topPx = top * this.rowHeight
        regionRectangles[id] = [l, topPx, r, topPx + this.featureHeight]
      }
    }

    return {
      rectangles: regionRectangles,
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }

  toJSON(): SerializedLayout {
    return {
      rectangles: Object.fromEntries(this.getRectangles()),
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }
}

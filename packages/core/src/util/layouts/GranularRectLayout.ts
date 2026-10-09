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

interface LowerSpan {
  top: number
  left: number
  right: number
}

// A rect in pitch units before it has a top; its rows from `lowerTop` down
// claim `lowerSpan`.
interface Placement {
  rectangle: Rectangle
  lowerTop: number
  lowerSpan: { l: number; r: number }
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
   * `lower` gives the rows lying wholly at or past `lower.top` px below the
   * rect's top a span of their own.
   *
   * @returns top position for the rect, or Null if laying
   *  out the rect would exceed maxHeight
   */
  addRect(
    id: string,
    left: number,
    right: number,
    height: number,
    lower?: LowerSpan,
  ): number | null {
    const storedRec = this.rectangles.get(id)
    if (storedRec) {
      return storedRec.top === null ? null : storedRec.top * this.pitchY
    }
    const placement = this.placement(left, right, height, lower)
    return this.commit(id, placement, this.firstFit(placement, 0))
  }

  /**
   * Lays out rects, none of them placed yet, at one shared top: the lowest
   * where every one fits. For the pieces of one feature drawn apart.
   */
  addRectsAtOneTop(
    rects: readonly {
      id: string
      left: number
      right: number
      height: number
      lower?: LowerSpan
    }[],
  ): number | null {
    const placements = rects.map(r =>
      this.placement(r.left, r.right, r.height, r.lower),
    )
    let top = 0
    for (let i = 0; i < placements.length && top <= this.maxHeight;) {
      const fit = this.firstFit(placements[i]!, top)
      if (fit === top) {
        i += 1
      } else {
        top = fit
        i = 0
      }
    }
    let result: number | null = null
    for (const [i, rect] of rects.entries()) {
      result = this.commit(rect.id, placements[i]!, top)
    }
    return result
  }

  private placement(
    left: number,
    right: number,
    height: number,
    lower?: LowerSpan,
  ): Placement {
    const pitchX = this.pitchX
    const pitchY = this.pitchY
    // Math.trunc, not `| 0`, which overflows above 2^31 genomic coordinates
    const rectangle: Rectangle = {
      l: Math.trunc(left / pitchX),
      r: Math.trunc(right / pitchX),
      top: null,
      h: Math.ceil(height / pitchY),
    }
    return {
      rectangle,
      lowerTop: lower ? Math.ceil(lower.top / pitchY) : rectangle.h,
      lowerSpan: lower
        ? {
            l: Math.trunc(lower.left / pitchX),
            r: Math.trunc(lower.right / pitchX),
          }
        : rectangle,
    }
  }

  // The first top at or past `fromTop` where the rect fits, maxHeight + 1
  // when none does. A rect starting below maxHeight may extend past it.
  private firstFit(
    { rectangle, lowerTop: pLowerTop, lowerSpan }: Placement,
    fromTop: number,
  ) {
    const { l: pLeft, r: pRight, h: pHeight } = rectangle
    const maxTop = this.maxHeight
    const bitmap = this.bitmap
    let top = fromTop

    // On a collision at row y, the next top worth trying is y + 1, not top + 1.
    // Rows top..y-1 are clear (y is the first hit walking upward) and every top'
    // between them still spans y, because y < top + pHeight — so nothing between
    // can fit. `top = y` plus the loop's own increment is that jump, and it turns
    // the scan from O(rows * pHeight) into O(rows): without it, a rect pHeight
    // rows tall re-tests the row that blocked it pHeight times over. Moving
    // the rect down only moves y up within it, so a hit above the lower span
    // blocks every top to y, and a hit in the lower span blocks just the tops
    // keeping y there: the jump goes to the first top putting y above it.
    outer: for (; top <= maxTop; top += 1) {
      const maxY = top + pHeight
      for (let y = top; y < maxY; y += 1) {
        const row = bitmap[y]
        if (!row) {
          continue
        }

        const intervals = row.getIntervals()
        const len = intervals.length

        if (len > 0) {
          const inLower = y - top >= pLowerTop
          const l = inLower ? lowerSpan.l : pLeft
          const r = inLower ? lowerSpan.r : pRight
          const blockedTop = inLower ? y - pLowerTop : y
          if (len < 40) {
            for (let i = 0; i < len; i += 2) {
              const start = intervals[i]!
              const end = intervals[i + 1]!
              if (end > l && start < r) {
                top = blockedTop
                continue outer
              }
            }
          } else {
            let low = 0
            let high = len >> 1

            while (low < high) {
              const mid = (low + high) >>> 1
              const midIdx = mid << 1
              if (intervals[midIdx + 1]! <= l) {
                low = mid + 1
              } else {
                high = mid
              }
            }

            const idx = low << 1
            if (idx < len) {
              const start = intervals[idx]!
              if (start < r) {
                top = blockedTop
                continue outer
              }
            }
          }
        }
      }
      break
    }
    return top
  }

  private commit(
    id: string,
    { rectangle, lowerTop, lowerSpan }: Placement,
    top: number,
  ) {
    this.rectangles.set(id, rectangle)
    if (top > this.maxHeight) {
      return null
    }
    rectangle.top = top
    const yEnd = top + rectangle.h
    for (let y = top; y < yEnd; y += 1) {
      this.getOrCreateRow(y).addRect(
        y - top >= lowerTop ? lowerSpan : rectangle,
      )
    }
    return top * this.pitchY
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

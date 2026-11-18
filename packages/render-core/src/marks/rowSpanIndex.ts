import { HIDDEN_ROW } from './rowTable.ts'

/**
 * Instances from `x` to `x2` grouped by the row they stand in, each row's in
 * start order, with the furthest end any instance of the row has reached so
 * far: what answers which of a row's spans, bars, rules or line steps overlap
 * a stretch of bp, in place of a spatial index over every instance. Each
 * stands in its own row only, so the question a hover asks is one row's, and
 * the answer is a binary search and a short walk.
 */
export interface RowSpanIndex {
  /** Each row key's first position in `order`, and the end, at `key + 1`. */
  readonly rowStart: Uint32Array
  /** The instance at each position: a row's together, in start order. */
  readonly order: Uint32Array
  /** The furthest end among the row's instances up to each position. */
  readonly reach: Uint32Array
}

const lowEnd = (x: Uint32Array, x2: Uint32Array, i: number) =>
  Math.min(x[i]!, x2[i]!)
const highEnd = (x: Uint32Array, x2: Uint32Array, i: number) =>
  Math.max(x[i]!, x2[i]!)

// A row that arrived nearly in start order, as `cells` writes one (an
// insertion lands just ahead of the run it interrupts), put in order by
// insertion, which costs one move per piece out of place; a row further out of
// order than that answers false and is left for `sortRow`.
function nudgeRow(
  order: Uint32Array,
  from: number,
  to: number,
  x: Uint32Array,
  x2: Uint32Array,
) {
  let moves = 0
  const budget = 4 * (to - from)
  for (let p = from + 1; p < to; p++) {
    const i = order[p]!
    const start = lowEnd(x, x2, i)
    let q = p - 1
    while (q >= from && lowEnd(x, x2, order[q]!) > start) {
      order[q + 1] = order[q]!
      q--
      if (++moves > budget) {
        order[q + 1] = i
        return false
      }
    }
    order[q + 1] = i
  }
  return true
}

// One row's instances into start order, ties in the order they came: the
// start and the position packed into one double where that is exact, which
// keeps the typed sort off a comparator.
function sortRow(
  order: Uint32Array,
  from: number,
  to: number,
  x: Uint32Array,
  x2: Uint32Array,
) {
  const n = to - from
  const slice = order.subarray(from, to)
  let lo = Infinity
  let hi = -Infinity
  for (const i of slice) {
    const s = lowEnd(x, x2, i)
    lo = Math.min(lo, s)
    hi = Math.max(hi, s)
  }
  if ((hi - lo + 1) * n < Number.MAX_SAFE_INTEGER) {
    const keys = new Float64Array(n)
    for (let k = 0; k < n; k++) {
      keys[k] = (lowEnd(x, x2, slice[k]!) - lo) * n + k
    }
    keys.sort()
    const placed = Uint32Array.from(slice)
    for (let k = 0; k < n; k++) {
      slice[k] = placed[keys[k]! % n]!
    }
  } else {
    slice.sort((a, b) => lowEnd(x, x2, a) - lowEnd(x, x2, b) || a - b)
  }
}

/**
 * The index over `count` spans from `x` to `x2`, each in the row `row` names
 * (row 0 where there is no lane), less those on `HIDDEN_ROW`, which no row
 * holds. A counting sort by row, a sort of each row the input left out of
 * start order, and one pass for the reach.
 */
export function rowSpanIndex(
  x: Uint32Array,
  x2: Uint32Array,
  row: Uint32Array | undefined,
  count = x.length,
): RowSpanIndex {
  let rows = 1
  if (row) {
    for (let i = 0; i < count; i++) {
      const r = row[i]!
      if (r !== HIDDEN_ROW && r + 1 > rows) {
        rows = r + 1
      }
    }
  }
  const rowStart = new Uint32Array(rows + 1)
  if (row) {
    for (let i = 0; i < count; i++) {
      const r = row[i]!
      if (r !== HIDDEN_ROW) {
        rowStart[r + 1]!++
      }
    }
    for (let r = 0; r < rows; r++) {
      rowStart[r + 1] = rowStart[r + 1]! + rowStart[r]!
    }
  } else {
    rowStart[1] = count
  }
  const placed = rowStart[rows]!
  const order = new Uint32Array(placed)
  if (row) {
    const next = rowStart.slice(0, rows)
    for (let i = 0; i < count; i++) {
      const r = row[i]!
      if (r !== HIDDEN_ROW) {
        order[next[r]!++] = i
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      order[i] = i
    }
  }
  const reach = new Uint32Array(placed)
  for (let r = 0; r < rows; r++) {
    const from = rowStart[r]!
    const to = rowStart[r + 1]!
    for (let p = from + 1; p < to; p++) {
      if (lowEnd(x, x2, order[p]!) < lowEnd(x, x2, order[p - 1]!)) {
        if (!nudgeRow(order, from, to, x, x2)) {
          sortRow(order, from, to, x, x2)
        }
        break
      }
    }
    let furthest = 0
    for (let p = from; p < to; p++) {
      furthest = Math.max(furthest, highEnd(x, x2, order[p]!))
      reach[p] = furthest
    }
  }
  return { rowStart, order, reach }
}

/**
 * The instances of row `key` whose span meets `[bpMin, bpMax]`, the ends
 * included, as a spatial index over the spans would answer them. The last
 * span starting at or before `bpMax` is a binary search away; walking back,
 * the reach says when no earlier span of the row can reach `bpMin`.
 */
export function spansInRow(
  index: RowSpanIndex,
  x: Uint32Array,
  x2: Uint32Array,
  key: number,
  bpMin: number,
  bpMax: number,
  out: number[],
) {
  const { rowStart, order, reach } = index
  if (key + 1 >= rowStart.length) {
    return
  }
  const from = rowStart[key]!
  for (
    let p = firstAfter(index, x, x2, key, bpMax) - 1;
    p >= from && reach[p]! >= bpMin;
    p--
  ) {
    const i = order[p]!
    if (highEnd(x, x2, i) >= bpMin) {
      out.push(i)
    }
  }
}

// The first position of row `key` whose span starts past `bpMax`, the row's
// end where none does.
function firstAfter(
  index: RowSpanIndex,
  x: Uint32Array,
  x2: Uint32Array,
  key: number,
  bpMax: number,
) {
  const { rowStart, order } = index
  let lo = rowStart[key]!
  let hi = rowStart[key + 1]!
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (lowEnd(x, x2, order[mid]!) <= bpMax) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

const NO_PREDECESSOR = 0xffffffff

// Whether instance `i` follows one in its row, which a path draws from.
function hasPredecessor(row: Uint32Array | undefined, i: number) {
  return i > 0 && (row === undefined || row[i - 1] === row[i])
}

/**
 * For each position of `index`, the earliest start among the predecessors of
 * the row's instances from that position on, a predecessor being the instance
 * just before in the given order where it stands in the same row: how far
 * back a linear path's segments from those instances reach, which tells
 * {@link segmentsIntoRow} where to stop.
 */
export function predecessorReach(
  index: RowSpanIndex,
  x: Uint32Array,
  x2: Uint32Array,
  row: Uint32Array | undefined,
) {
  const { rowStart, order } = index
  const back = new Uint32Array(order.length)
  for (let r = 0; r + 1 < rowStart.length; r++) {
    let earliest = NO_PREDECESSOR
    for (let p = rowStart[r + 1]! - 1; p >= rowStart[r]!; p--) {
      const i = order[p]!
      if (hasPredecessor(row, i)) {
        earliest = Math.min(earliest, lowEnd(x, x2, i - 1))
      }
      back[p] = earliest
    }
  }
  return back
}

/**
 * The instances of row `key` that start past `bpMax` while their predecessor
 * starts at or before it: those whose segment back to the predecessor, as a
 * linear path draws it, may cross a window ending at `bpMax` though their own
 * span starts past it, which {@link spansInRow} leaves out. `back` is the
 * index's {@link predecessorReach}.
 */
export function segmentsIntoRow(
  index: RowSpanIndex,
  back: Uint32Array,
  x: Uint32Array,
  x2: Uint32Array,
  row: Uint32Array | undefined,
  key: number,
  bpMax: number,
  out: number[],
) {
  const { rowStart, order } = index
  if (key + 1 < rowStart.length) {
    const end = rowStart[key + 1]!
    for (
      let p = firstAfter(index, x, x2, key, bpMax);
      p < end && back[p]! <= bpMax;
      p++
    ) {
      const i = order[p]!
      if (hasPredecessor(row, i) && lowEnd(x, x2, i - 1) <= bpMax) {
        out.push(i)
      }
    }
  }
}

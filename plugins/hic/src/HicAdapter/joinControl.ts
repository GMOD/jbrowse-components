import type { ContactRecords } from '@gmod/hic'

/**
 * Which bins along each axis a file can report on: 1 where its normalization
 * vector holds a usable factor, 0 where it masks the bin. Undefined is every
 * bin, as raw counts have no mask.
 */
export interface AxisMasks {
  x?: Uint8Array
  y?: Uint8Array
}

/** Both files' counts for every cell either one holds. */
export interface JoinedCounts {
  bin1: Int32Array
  bin2: Int32Array
  counts: Float32Array
  control: Float32Array
}

/** The half-open bin range two record sets span along one axis. */
export function binExtent(a: Int32Array, b: Int32Array) {
  let lo = Infinity
  let hi = -Infinity
  for (const bins of [a, b]) {
    for (let i = 0; i < bins.length; i++) {
      const v = bins[i]!
      lo = v < lo ? v : lo
      hi = v > hi ? v : hi
    }
  }
  return lo > hi ? ([0, 0] as const) : ([lo, hi + 1] as const)
}

// Indices of `bins` grouped by row (`bin - origin`), `starts[r]` to
// `starts[r + 1]` being row r's slice: a counting sort, linear in the records.
function rowsOf(bins: Int32Array, origin: number, nRows: number) {
  const starts = new Int32Array(nRows + 1)
  for (let i = 0; i < bins.length; i++) {
    starts[bins[i]! - origin + 1]!++
  }
  for (let r = 0; r < nRows; r++) {
    starts[r + 1]! += starts[r]!
  }
  const cursor = starts.slice(0, nRows)
  const order = new Int32Array(bins.length)
  for (let i = 0; i < bins.length; i++) {
    order[cursor[bins[i]! - origin]!++] = i
  }
  return { starts, order }
}

const valid = (mask: Uint8Array | undefined, i: number) =>
  mask === undefined || mask[i] === 1

/**
 * The outer join of a map and its control on bin pairs, so a contact one
 * condition lost still draws. A cell only one file lists is a 0 in the other,
 * unless that file's normalization masks either bin: a sparse `.hic` omits a
 * masked bin exactly as it omits an empty one, and a masked control bin read
 * as 0 would paint a huge ratio.
 *
 * Bucketed by row with one dense scratch row, rather than a map keyed on the
 * pair, which measured about ten times slower at 4.3M records a side.
 */
export function joinControl(
  observed: ContactRecords,
  control: ContactRecords,
  masks: { observed: AxisMasks; control: AxisMasks; x0: number; y0: number },
): JoinedCounts {
  const [xLo, xHi] = binExtent(observed.bin1, control.bin1)
  const [yLo, yHi] = binExtent(observed.bin2, control.bin2)
  const nx = xHi - xLo
  const ny = yHi - yLo
  const capacity = observed.bin1.length + control.bin1.length
  const out: JoinedCounts = {
    bin1: new Int32Array(capacity),
    bin2: new Int32Array(capacity),
    counts: new Float32Array(capacity),
    control: new Float32Array(capacity),
  }
  let n = 0
  const emit = (b1: number, b2: number, obs: number, ctrl: number) => {
    out.bin1[n] = b1
    out.bin2[n] = b2
    out.counts[n] = obs
    out.control[n] = ctrl
    n++
  }

  const o = rowsOf(observed.bin1, xLo, nx)
  const c = rowsOf(control.bin1, xLo, nx)
  // index into `control` of the cell at each column, -1 for none, -2 once
  // an observed record has taken it
  const scratch = new Int32Array(ny).fill(-1)
  const { x0, y0 } = masks
  const oMask = masks.observed
  const cMask = masks.control

  for (let r = 0; r < nx; r++) {
    const b1 = r + xLo
    for (let k = c.starts[r]!; k < c.starts[r + 1]!; k++) {
      const j = c.order[k]!
      scratch[control.bin2[j]! - yLo] = j
    }
    for (let k = o.starts[r]!; k < o.starts[r + 1]!; k++) {
      const i = o.order[k]!
      const b2 = observed.bin2[i]!
      const col = b2 - yLo
      const j = scratch[col]!
      if (j >= 0) {
        emit(b1, b2, observed.counts[i]!, control.counts[j]!)
        scratch[col] = -2
      } else if (valid(cMask.x, b1 - x0) && valid(cMask.y, b2 - y0)) {
        emit(b1, b2, observed.counts[i]!, 0)
      }
    }
    for (let k = c.starts[r]!; k < c.starts[r + 1]!; k++) {
      const j = c.order[k]!
      const b2 = control.bin2[j]!
      const col = b2 - yLo
      if (
        scratch[col] !== -2 &&
        valid(oMask.x, b1 - x0) &&
        valid(oMask.y, b2 - y0)
      ) {
        emit(b1, b2, 0, control.counts[j]!)
      }
      scratch[col] = -1
    }
  }
  return {
    bin1: out.bin1.slice(0, n),
    bin2: out.bin2.slice(0, n),
    counts: out.counts.slice(0, n),
    control: out.control.slice(0, n),
  }
}

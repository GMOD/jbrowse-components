/**
 * "Which entries sit at this genomic position?", answered in log time instead
 * of by scanning the array.
 *
 * The flat per-event arrays the worker ships — `mismatchPositions`,
 * `interbasePositions`, `gapPositions` — arrive in READ order, because that is
 * the order the reads were walked in. Every per-hover reader of them therefore
 * scanned the whole array to find the handful of entries under the cursor, and
 * a hover is a mousemove: `hitTestCoverage` -> `findSignificantInBin`, then
 * `getCoverageBin` -> `countSnpsAtPosition`, then the deletion and interbase
 * tallies, four full scans per pointer motion per block — times however many
 * BAM tracks are stacked in the view. On the six-track pan profile those arrays
 * hold hundreds of thousands of entries each.
 *
 * ## Cached against the array, not against a result object
 *
 * The index is memoized in a `WeakMap` keyed by the positions array ITSELF.
 * That is what makes this a drop-in: no consumer passes an index, plumbs a
 * cache or decides when to invalidate, and both the alignments and MAF readers
 * get it by calling the same functions they already called.
 *
 * It is also exactly the right invalidation. A refetch replaces the array
 * wholesale — the worker allocates fresh transferables per reply and the old
 * one is detached — so a stale index cannot be reached by anything, and the
 * WeakMap holds nothing once the data is dropped. (`computeVisibleLabels` keys
 * its own cache on the RPC result object for the same reason. One level down is
 * better here, because MAF hands these functions bare arrays with no result
 * object to key on.)
 *
 * It costs 8 bytes per entry, retained for as long as the array it indexes is,
 * and only from the first hover — a cold render builds none. That is against a
 * mismatch array which is already 12 bytes an entry across its own parallel
 * arrays, so the index is a fraction of what it makes usable.
 *
 * ## Building it
 *
 * Counting sort over the span the positions occupy, so building is O(n + span)
 * rather than the O(n log n) a comparison sort would cost — a first hover after
 * a fetch must not stall. Positions are dense within a region, so the span is
 * the region width and the sort is effectively linear.
 *
 * The exception is a handful of events scattered over a wide window (a shallow
 * region's clips, a MAF block at low zoom), where a bp-indexed histogram would
 * allocate hugely to sort almost nothing. `SPARSE_RATIO` picks the comparison
 * sort there — where n is small, so O(n log n) with a JS comparator is
 * cheap. Both produce the same order.
 *
 * Ties are NOT broken and the two sorts may order equal positions differently.
 * Every consumer tallies a run of equal positions into counts or length stats,
 * so within-run order is not observable — say so here rather than letting a
 * future reader assume stability.
 */

// Above this span-per-entry, the bp-indexed histogram costs more to allocate
// and clear than the comparison sort costs to run. The constant is not
// delicate: the two are within noise of each other across a wide band around
// it, and the regimes it separates differ by orders of magnitude.
const SPARSE_RATIO = 8

export interface PositionIndex {
  /** Entry indices, ordered by the position each one carries. */
  order: Uint32Array
  /**
   * Those entries' positions, in the same order — stored rather than read
   * through `order` so a binary search probes one array instead of chasing an
   * indirection at every step.
   */
  sorted: Uint32Array
}

const EMPTY: PositionIndex = {
  order: new Uint32Array(0),
  sorted: new Uint32Array(0),
}

const cache = new WeakMap<Uint32Array, PositionIndex>()

/**
 * The position index for `positions`, built on first use and cached against the
 * array. `stride`/`offset` read every stride'th entry starting at offset, for
 * an array that interleaves something else — `gapPositions` holds [start, end]
 * pairs, so its starts are stride 2.
 */
export function positionIndexFor(positions: Uint32Array, stride = 1) {
  const hit = cache.get(positions)
  if (hit) {
    return hit
  }
  const built = buildPositionIndex(positions, stride)
  cache.set(positions, built)
  return built
}

function buildPositionIndex(
  positions: Uint32Array,
  stride: number,
): PositionIndex {
  const n = Math.floor(positions.length / stride)
  if (n === 0) {
    return EMPTY
  }
  let min = positions[0]!
  let max = min
  for (let i = 1; i < n; i++) {
    const p = positions[i * stride]!
    if (p < min) {
      min = p
    }
    if (p > max) {
      max = p
    }
  }
  const span = max - min + 1
  const order = new Uint32Array(n)
  if (span > n * SPARSE_RATIO + 1024) {
    // Sparse: sort n indices directly. A plain Array is what `sort` with a
    // comparator wants; the result is copied into the typed array the readers
    // index.
    const idx = Array.from({ length: n }, (_, i) => i)
    idx.sort((a, b) => positions[a * stride]! - positions[b * stride]!)
    for (let i = 0; i < n; i++) {
      order[i] = idx[i]!
    }
  } else {
    // Counting sort: tally per bp, prefix-sum into starting offsets, scatter.
    const starts = new Uint32Array(span + 1)
    for (let i = 0; i < n; i++) {
      starts[positions[i * stride]! - min + 1]!++
    }
    for (let b = 0; b < span; b++) {
      starts[b + 1]! += starts[b]!
    }
    for (let i = 0; i < n; i++) {
      order[starts[positions[i * stride]! - min]!++] = i
    }
  }
  const sorted = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    sorted[i] = positions[order[i]! * stride]!
  }
  return { order, sorted }
}

/**
 * The first slot in `sorted` holding a position at or after `target` — the
 * standard lower bound, so `[lowerBound(P), lowerBound(P + 1))` is the run of
 * entries at exactly P and `[lowerBound(a), lowerBound(b))` is the run in
 * `[a, b)`.
 */
export function lowerBound(sorted: Uint32Array, target: number) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

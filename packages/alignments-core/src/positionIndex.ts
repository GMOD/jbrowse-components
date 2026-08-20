/**
 * "Which entries sit at this genomic position?", answered in log time instead
 * of by scanning the array.
 *
 * The flat per-event arrays the worker ships — `mismatchPositions`,
 * `interbasePositions`, `gapPositions` — were all built in READ order, because
 * that is the order the reads are walked in. Every per-hover reader of them
 * therefore scanned the whole array to find the handful of entries under the
 * cursor, and a hover is a mousemove: `hitTestCoverage` -> `findSignificantInBin`,
 * then `getCoverageBin` -> `countSnpsAtPosition`, then the deletion and interbase
 * tallies, four full scans per pointer motion per block — times however many BAM
 * tracks are stacked in the view. On the six-track pan profile those arrays hold
 * hundreds of thousands of entries each.
 *
 * ## The producer sorts. There is no cache here, and there was.
 *
 * Every consumer's array now arrives ascending, so a reader `lowerBound`s what it
 * was given and reads the parallel arrays at the same subscript — nothing built,
 * nothing retained, nothing to invalidate. `buildMismatchArrays` and
 * `buildInterbaseArrays` call `positionOrder` below; MAF's twins do the same.
 *
 * This replaced a `WeakMap<Uint32Array, PositionIndex>` memoized on the main
 * thread, and the whole of what that cost is worth keeping, because the memo
 * looked free at each call site:
 *
 * - **8 bytes an entry**, measured exactly, retained for as long as the array —
 *   7.6 MB per 1M-entry array, per region, per stacked track, behind a call that
 *   read as a lookup. The bench that measured it is gone with the memo; the
 *   numbers are in REJECTED_IDEAS.md.
 * - **An invalidation invariant nothing enforced.** It was correct only because a
 *   refetch replaces the array wholesale; anything mutating a positions array in
 *   place would have gotten a silently stale index.
 * - **A silent wrong answer per unkeyed parameter.** `stride` was not in the key,
 *   so one array read at two strides got whichever index was built first — the
 *   defect this file shipped, and a property of identity-keyed caches rather than
 *   of that bug.
 * - It was also **slower**: the `order[k]` indirection to reach the parallel
 *   arrays cost 1.2-1.4x per hover against reading a sorted array directly.
 *
 * ## Two shapes of sorted, because interbase could not follow the simple one
 *
 * `mismatchPositions` is sorted outright. `interbasePositions` is sorted **within
 * each of its (insertions, softclips, hardclips) blocks** and not across them,
 * because those boundaries are a contract: `numInsertions` / `numSoftclips` /
 * `numHardclips` let three GPU passes slice subranges without re-scanning
 * `interbaseTypes` (`insertion/packGpu.ts`, `features/clip/packGpu.ts`,
 * `shared/uploadTypes.ts`), and sorting the array outright breaks all three.
 *
 * `forEachAtPosition` is what reads that shape — one binary search per block. It
 * is worth knowing this beat the alternative the TODO entry proposed, which was to
 * ship a 4-byte-an-entry order array from the worker: sorting inside the blocks
 * costs nothing extra, ships nothing extra, and leaves every slice untouched.
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

// An empty array has no entries at ANY stride, so one shared object would be a
// correct answer whatever was asked for — and it was a singleton here until it
// detached itself. **`sorted` is SHIPPED.** `buildMismatchArrays` returns it as
// `mismatchPositions` and MAF's two producers return it as `mismatchPositions` /
// `insertionPositions`, all of which land in an RPC result whose transfer list
// is derived from the payload. postMessage transfers by MOVING, so the first
// empty region gave the module's own buffer away, and every later call that took
// this branch put an already-detached buffer in its list and threw
// `DataCloneError` for the whole fetch.
//
// It reproduced on the HG002 chain, where LGVSyntenyDisplay renders CIGAR-string
// alignments that carry no sequence and therefore no mismatches, so the empty
// branch is the ordinary path rather than an edge. A zero-length allocation
// costs nothing; sharing one costs a fetch.
function emptyIndex(): PositionIndex {
  return { order: new Uint32Array(0), sorted: new Uint32Array(0) }
}

/**
 * The sort, computed and handed back. There is no cache in this module, and that
 * is the point: every consumer's array is sorted by whoever PRODUCED it, so a
 * reader binary-searches what it was given and retains nothing.
 *
 * `buildMismatchArrays` and `buildInterbaseArrays` are the two callers, plus
 * MAF's twins and `deletionSpanIndex`, which builds an array of its own. Note
 * that the sparse fallback below is the reason to share this rather than write a
 * counting sort at each call site.
 *
 * `stride` reads every stride'th entry from the start of the array, for one that
 * interleaves something else — `gapPositions` holds [start, end] pairs, so its
 * starts are stride 2.
 */
export function positionOrder(positions: Uint32Array, stride = 1) {
  return buildPositionIndex(positions, stride)
}

function buildPositionIndex(
  positions: Uint32Array,
  stride: number,
): PositionIndex {
  const n = Math.floor(positions.length / stride)
  if (n === 0) {
    return emptyIndex()
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
 *
 * `from`/`to` bound the search to one RUN of a multi-run array. That is what
 * `interbasePositions` is: sorted within each of its (insertions, softclips,
 * hardclips) blocks but not across them, because those block boundaries are a
 * contract three GPU passes slice on. See `forEachAtPosition`.
 */
export function lowerBound(
  sorted: Uint32Array,
  target: number,
  from = 0,
  to = sorted.length,
) {
  let lo = from
  let hi = to
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

/**
 * Visit every entry at exactly `position`, across one or more ascending runs.
 *
 * `blockEnds` are the runs' exclusive end offsets — `[n]` for a single sorted
 * array, `[numInsertions, +numSoftclips, +numHardclips]` for the interbase set.
 * One binary search per run, so an interbase hover costs three instead of one and
 * still touches nothing but the entries under the cursor.
 *
 * The alternative was a side index over the whole array, which is what this
 * replaced: it answered in one search but had to be built, retained and
 * invalidated, and could not be built at the producer because sorting the array
 * outright would break the block contract. Three searches over data that sorts
 * itself is the cheaper trade in every dimension except elegance.
 */
export function forEachAtPosition(
  positions: Uint32Array,
  blockEnds: readonly number[],
  position: number,
  visit: (i: number) => void,
) {
  let start = 0
  for (const end of blockEnds) {
    for (
      let i = lowerBound(positions, position, start, end);
      i < end && positions[i] === position;
      i++
    ) {
      visit(i)
    }
    start = end
  }
}

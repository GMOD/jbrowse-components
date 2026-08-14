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
 * ## Prefer sorting at the PRODUCER; this memo is the fallback
 *
 * Where the producer can emit ascending positions, it should, and then no index
 * exists to cache: the reader `lowerBound`s the shipped array and reads the
 * parallel arrays at the same subscript. `buildMismatchArrays` does exactly that
 * via `positionOrder` below, so the two hottest readers — the ones quoted above —
 * hold nothing. That is strictly better than what this file offers: no retained
 * bytes, no lifetime question, no invalidation invariant, and one less
 * indirection per entry on the mousemove.
 *
 * **`interbasePositions` is the case that cannot follow**, and the reason is a
 * competing contract rather than effort: it is deliberately grouped as
 * (insertions, softclips, hardclips) with `numInsertions` / `numSoftclips` /
 * `numHardclips` so three GPU passes can slice subranges without re-scanning
 * `interbaseTypes` (`insertion/packGpu.ts`, `shared/clipPass.ts`,
 * `shared/uploadTypes.ts`). Sorting it by position breaks all three. Its two
 * per-hover readers — `countInterbaseAtPosition` and `collectInterbaseStats` —
 * are what keeps the memo below alive; see TODO.md for the shipped-order-array
 * alternative that would retire it.
 *
 * ## What the memo costs, when it is used
 *
 * 8 bytes per entry — measured exactly, `benches/hoverIndexMemory.bench.ts` —
 * retained for as long as the array it indexes, and only from the first hover, so
 * a cold render builds none. Read that as the absolute rather than the ratio:
 * 7.6 MB per 1M-entry array, per region, per stacked track. It is 2.00x the
 * positions array it indexes and 0.57x the whole parallel set it makes usable.
 *
 * The invalidation is by construction, and that is the part to be suspicious of:
 * a refetch replaces the array wholesale — the worker allocates fresh
 * transferables per reply and the old one is detached — so a stale index cannot be
 * reached. **Nothing enforces that.** Anything that mutated a positions array in
 * place would get a silently stale index, which is why the rule is to sort at the
 * producer wherever a producer exists.
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
  /**
   * The stride this index was built at. Read by the memo, not by consumers —
   * see the cache comment below for why it is stored rather than keyed on.
   */
  stride: number
}

// An empty array has no entries at ANY stride, so this singleton is the right
// answer whatever was asked for — its `stride: 1` only means a stride-2 caller
// re-derives it, and `buildPositionIndex` returns before allocating anything.
const EMPTY: PositionIndex = {
  order: new Uint32Array(0),
  sorted: new Uint32Array(0),
  stride: 1,
}

// One index per array, and it CARRIES the stride it was built at rather than
// being keyed by it.
//
// The stride has to be checked somehow: one array can be read at two strides,
// and those are different indexes. `gapPositions` is the case — stride 2 over
// its starts, stride 1 if anything ever wants every entry — and a memo that
// ignored the stride handed the second caller the first one's index, silently
// and with a plausible answer (`[10, 20, 30, 50, 60, 90]` where the starts are
// `[10, 30, 50]`), indistinguishable from a region whose gaps really do sit
// there.
//
// Checking it on the index costs NO memory, which a per-stride collection does:
// this index is 8 bytes an entry, so on the 1M-entry fixture it is 7.6 MB per
// array, per region, per stacked track, and the rule on this path is that
// nothing gets added beside it without a reason. A stride mismatch REPLACES the
// entry instead of holding both.
//
// That trade is only right because production is entirely stride 1 —
// `coverageDownsampling` and `tooltipUtils` between them are every caller, and
// `deletionSpanIndex` copies gap starts into an array of their own rather than
// striding. A future path that alternates two strides over ONE array on the
// mousemove would rebuild per hover, which is worse than the array this
// replaces; if that ever appears, hold both and pay the bytes deliberately.
const cache = new WeakMap<Uint32Array, PositionIndex>()

/**
 * The position index for `positions`, built on first use and cached against the
 * array. `stride` reads every stride'th entry from the start of the array, for
 * one that interleaves something else — `gapPositions` holds [start, end] pairs,
 * so its starts are stride 2. Asking for a stride the cached index was not built
 * at rebuilds it.
 */
export function positionIndexFor(positions: Uint32Array, stride = 1) {
  const hit = cache.get(positions)
  if (hit?.stride === stride) {
    return hit
  }
  const built = buildPositionIndex(positions, stride)
  cache.set(positions, built)
  return built
}

/**
 * The sort with NO cache attached — `{ order, sorted }` computed and handed back.
 *
 * This is the primitive a PRODUCER wants: `buildMismatchArrays` calls it to emit
 * its parallel arrays in ascending position order, which is what lets the hover
 * readers `lowerBound` the shipped array and keep no index at all. Prefer it to
 * `positionIndexFor` anywhere the caller owns the output, and note that the
 * sparse fallback above is the reason to share this rather than write a counting
 * sort at the call site.
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
  return { order, sorted, stride }
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

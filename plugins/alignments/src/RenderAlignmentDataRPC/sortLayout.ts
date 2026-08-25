import Flatbush from '@jbrowse/core/util/flatbush'
import { placeRect } from '@jbrowse/core/util/layouts/placeRect'

import { emptyConnectingLinesUploadData } from '../features/connectingLines/types.ts'
import { emptyLinkedReadLinesUploadData } from '../features/linkedReads/types.ts'
import { emptyOverlapsUploadData } from '../features/overlap/types.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../shaders/slang/gap.consts.generated.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../shared/types.ts'
import { UNCAPPED } from './types.ts'

import type { ReadKey, ReadKeys } from '../shared/readIdentity.ts'
import type { SortedBy } from '../shared/types.ts'
import type {
  LaidOutPileupData,
  RowCap,
  RowCapSource,
  WorkerPileupData,
} from './types'

const DELETION_CHAR = 42 // '*'

// Sort types that rank reads by the longest interbase event at the sort
// position, mapped to the interbase kind each one measures. A lookup miss is
// what identifies the comparator-based types (position/strand/tag), so this
// table is the whole "is this an interbase sort" test.
const INTERBASE_SORT_TYPES: Partial<Record<SortedBy['type'], number>> = {
  insertion: INTERBASE_INSERTION,
  softclip: INTERBASE_SOFTCLIP,
  hardclip: INTERBASE_HARDCLIP,
}

/**
 * Total order over read indices, used as the final tiebreak of every placement
 * order in this file: genomic span first, then the read's unique id.
 *
 * The id matters. First-fit-lowest-row placement is arrival-order-sensitive by
 * construction and JS sort is stable, so a comparator that leaves ties hands
 * them to array position — i.e. to whatever order the worker happened to emit
 * reads in. Nothing guarantees that order, so layout was a function of the read
 * set AND its arrival order; comparators here must be total so it is a function
 * of the set alone. (This was suspected of causing the cross-backend gate's
 * pileup drift, but never confirmed to — see browser-tests/crossBackendGate.ts.)
 *
 * Span is compared first, so the key compare only runs for reads sharing both
 * endpoints. The key is numeric for BAM/CRAM and the id string otherwise
 * (shared/readIdentity.ts), and `<`/`>` totally order either — a numeric file
 * offset and a lexicographic id are equally arbitrary, and all this has to be is
 * a function of the read set.
 */
function compareReadsCanonically(
  readPositions: Uint32Array,
  readKeys: ReadKeys,
  a: number,
  b: number,
) {
  const startDiff = readPositions[a * 2]! - readPositions[b * 2]!
  if (startDiff !== 0) {
    return startDiff
  }
  const endDiff = readPositions[a * 2 + 1]! - readPositions[b * 2 + 1]!
  if (endDiff !== 0) {
    return endDiff
  }
  const ia = readKeys[a]!
  const ib = readKeys[b]!
  return ia < ib ? -1 : ia > ib ? 1 : 0
}

function sortByMapWithUnknownsLast(
  arr: number[],
  map: Map<number, number>,
  desc: boolean,
  data: WorkerPileupData,
) {
  const { readPositions, readKeys } = data
  arr.sort((a, b) => {
    const aVal = map.get(a) ?? 0
    const bVal = map.get(b) ?? 0
    if (aVal !== 0 && bVal === 0) {
      return -1
    }
    if (aVal === 0 && bVal !== 0) {
      return 1
    }
    const byVal = desc ? bVal - aVal : aVal - bVal
    return byVal !== 0
      ? byVal
      : compareReadsCanonically(readPositions, readKeys, a, b)
  })
}

function buildSoftclipExpansions(data: WorkerPileupData) {
  const expansions = new Map<number, { start: number; end: number }>()
  for (let i = 0; i < data.interbasePositions.length; i++) {
    if (data.interbaseTypes[i] !== INTERBASE_SOFTCLIP) {
      continue
    }
    const readIdx = data.interbaseReadIndices[i]!
    const pos = data.interbasePositions[i]!
    const len = data.interbaseLengths[i]!
    const readStart = data.readPositions[readIdx * 2]!
    // A left clip sits at the read's leftmost mapped base and expands the read
    // leftward; a right clip sits past the rightmost base and expands rightward.
    // readStart is the read's true alignment start, so a left clip sits exactly
    // on it.
    const isLeftClip = pos <= readStart
    const clipStart = isLeftClip ? pos - len : pos
    const clipEnd = clipStart + len
    const existing = expansions.get(readIdx)
    if (!existing) {
      expansions.set(readIdx, { start: clipStart, end: clipEnd })
    } else {
      if (clipStart < existing.start) {
        existing.start = clipStart
      }
      if (clipEnd > existing.end) {
        existing.end = clipEnd
      }
    }
  }
  return expansions.size > 0 ? expansions : undefined
}

// Per-read effective [start,end) (softclip-expanded when `expansions` present) as
// two parallel arrays, computed once. The single spelling of the soft-clip union
// rule, so no caller can expand a read differently from the layout that places
// it. Parallel arrays rather than `{start,end}` objects because the order-building
// sort comparators compare extents O(n log n) times and every object would be an
// allocation.
interface ReadExtents {
  starts: Float64Array
  ends: Float64Array
}
function buildReadExtents(
  data: WorkerPileupData,
  expansions: Map<number, { start: number; end: number }> | undefined,
  numReads: number,
): ReadExtents {
  const starts = new Float64Array(numReads)
  const ends = new Float64Array(numReads)
  for (let i = 0; i < numReads; i++) {
    const s = data.readPositions[i * 2]!
    const e = data.readPositions[i * 2 + 1]!
    const exp = expansions?.get(i)
    starts[i] = exp ? Math.min(s, exp.start) : s
    ends[i] = exp ? Math.max(e, exp.end) : e
  }
  return { starts, ends }
}

// Widest [start,end) first (by span), genomic start as a deterministic tiebreak
// — so the largest alignments take the lowest rows. Shared by the single-region
// and multi-region largest-first orderings so the rule can't drift.
function compareByExtentDesc(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  const byExtent = bEnd - bStart - (aEnd - aStart)
  return byExtent !== 0 ? byExtent : aStart - bStart
}

// Project a per-read Y layout onto a per-record `*Ys` array via each record's
// parent-read index. Every row-instanced feature (gap, mismatch, interbase, …)
// derives its row this way, so `cloneWithLayout` calls this once per feature kind
// instead of spelling the same loop seven times.
function remapYs(readIndices: Uint32Array, readYs: Uint16Array) {
  const out = new Uint16Array(readIndices.length)
  for (let i = 0; i < readIndices.length; i++) {
    out[i] = readYs[readIndices[i]!]!
  }
  return out
}

// Build the per-read sort key for the two data-driven sort types: the base
// call at `sortPos` (basePair) or the longest interbase length at `sortPos`
// (insertion/softclip/hardclip). `desc` is true for interbases (longest first)
// and false for base calls. Returns undefined for the comparator-based types
// (position/strand/tag), which don't go through a key map.
function buildSortKeyMap(
  data: WorkerPileupData,
  type: SortedBy['type'],
  sortPos: number,
): { map: Map<number, number>; desc: boolean } | undefined {
  let result: { map: Map<number, number>; desc: boolean } | undefined
  const targetType = INTERBASE_SORT_TYPES[type]
  if (type === 'basePair') {
    const { mismatchReadIndices, mismatchPositions, mismatchBases } = data
    const { gapReadIndices, gapPositions, gapTypes } = data
    const baseAtPos = new Map<number, number>()
    for (let i = 0; i < mismatchPositions.length; i++) {
      if (mismatchPositions[i] === sortPos) {
        baseAtPos.set(mismatchReadIndices[i]!, mismatchBases[i]!)
      }
    }
    for (let i = 0; i < gapPositions.length / 2; i++) {
      if (gapTypes[i] === GAP_DELETION) {
        const gapStart = gapPositions[i * 2]!
        const gapEnd = gapPositions[i * 2 + 1]!
        if (gapStart <= sortPos && gapEnd > sortPos) {
          const readIdx = gapReadIndices[i]!
          if (!baseAtPos.has(readIdx)) {
            baseAtPos.set(readIdx, DELETION_CHAR)
          }
        }
      }
    }
    result = { map: baseAtPos, desc: false }
  } else if (targetType !== undefined) {
    const { interbaseReadIndices, interbasePositions } = data
    const { interbaseLengths, interbaseTypes } = data
    const lengthAtPos = new Map<number, number>()
    for (let i = 0; i < interbasePositions.length; i++) {
      if (
        interbaseTypes[i] === targetType &&
        interbasePositions[i] === sortPos
      ) {
        const readIdx = interbaseReadIndices[i]!
        const len = interbaseLengths[i]!
        if (len > (lengthAtPos.get(readIdx) ?? 0)) {
          lengthAtPos.set(readIdx, len)
        }
      }
    }
    result = { map: lengthAtPos, desc: true }
  }
  return result
}

function sortOverlappingByIndex(
  overlapping: number[],
  data: WorkerPileupData,
  sortedBy: SortedBy,
  sortTagValues: string[] | undefined,
  keyMap: { map: Map<number, number>; desc: boolean } | undefined,
) {
  const { type } = sortedBy
  const { readPositions, readKeys } = data
  const canonical = (a: number, b: number) =>
    compareReadsCanonically(readPositions, readKeys, a, b)
  if (keyMap) {
    sortByMapWithUnknownsLast(overlapping, keyMap.map, keyMap.desc, data)
  } else if (type === 'position') {
    overlapping.sort(canonical)
  } else if (type === 'strand') {
    const { readStrands } = data
    overlapping.sort(
      (a, b) => readStrands[b]! - readStrands[a]! || canonical(a, b),
    )
  } else if (type === 'tag' && sortTagValues) {
    // Numeric sort only when every present value parses as a number (empty/
    // missing values coerce to 0 and don't force string mode). A single
    // numeric-looking first value must not decide the mode for a column of
    // string tags — that garbled string tags into NaN comparisons.
    const allNumeric = overlapping.every(i => {
      const v = sortTagValues[i]
      return v === undefined || v === '' || !Number.isNaN(Number(v))
    })
    if (allNumeric) {
      overlapping.sort(
        (a, b) =>
          Number(sortTagValues[b] ?? 0) - Number(sortTagValues[a] ?? 0) ||
          canonical(a, b),
      )
    } else {
      overlapping.sort(
        (a, b) =>
          (sortTagValues[b] ?? '').localeCompare(sortTagValues[a] ?? '') ||
          canonical(a, b),
      )
    }
  } else {
    // Unrecognized sort type (a legacy or misspelled `sortedBy.type`, which is
    // a bare string). Falling through used to leave the reads in arrival order;
    // sort canonically so an unknown type degrades to a deterministic layout
    // rather than an unstable one.
    overlapping.sort(canonical)
  }
}

/**
 * Split the reads into the ones a position sort ranks — in ranked order — and
 * the rest, which fill gaps around them in whatever order the caller places
 * them.
 *
 * MEMBERSHIP IS NOT JUST "this read's alignment covers sortPos". An interbase
 * mark sits BETWEEN reference bases, so a right-edge soft or hard clip (and a
 * trailing insertion) is recorded at the read's EXCLUSIVE end — which
 * `end > sortPos` rejects. That dropped exactly the reads a clip sort exists to
 * raise: at a breakpoint the clipped reads sank BELOW the ones reading through
 * it, the precise inverse of the request, and since the track menu shows every
 * interbase type with "Base pair" checked, the sort still read as applied. A
 * read carrying a ranked mark at sortPos therefore counts however its alignment
 * ends. Left-edge clips sit on the read's own start and always passed, so the
 * feature worked on half its inputs.
 *
 * Shared by both layout paths for the same reason `sortForRegions` is: the two
 * spelled the span test separately, and a rule spelled twice is one that drifts.
 */
function partitionBySort(
  data: WorkerPileupData,
  sortedBy: SortedBy,
  sortTagValues: string[] | undefined,
) {
  const { type, pos: sortPos } = sortedBy
  const { readPositions } = data
  const keyMap = buildSortKeyMap(data, type, sortPos)
  const ranked: number[] = []
  const rest: number[] = []
  for (let i = 0; i < data.readKeys.length; i++) {
    const start = readPositions[i * 2]!
    const end = readPositions[i * 2 + 1]!
    if ((start <= sortPos && end > sortPos) || keyMap?.map.has(i)) {
      ranked.push(i)
    } else {
      rest.push(i)
    }
  }
  sortOverlappingByIndex(ranked, data, sortedBy, sortTagValues, keyMap)
  return { ranked, rest }
}

// Place a rect but never let the layout grow past `maxRows` rows. When
// placeRect opens a row beyond the cap (it has no limit by design) we pop that
// overflow row back off and return the `maxRows` sentinel, which renders flush
// against the content bottom (just out of view) so capped reads don't expand
// the pileup. Callers treat a `maxRows` result as truncation. A bare number
// rather than a {y, overflow} pair so the per-read hot loop allocates nothing.
//
// `maxRows` is bounded ≤ 65534 by the caller so the sentinel and every real row
// index fit the Uint16Array — at >65535x coverage the raw count would wrap.
export function placeRectCapped(
  rows: number[][],
  start: number,
  end: number,
  maxRows: number,
) {
  const y = placeRect(rows, start, end)
  const overflow = y >= maxRows
  if (overflow) {
    rows.pop()
  }
  return overflow ? maxRows : y
}

// Read count at which the interval-partitioning fast path in `computeLayout`
// beats the placeRect row-scan. Below this, pileup depth is low enough that the
// scan's O(reads * depth) is already sub-millisecond and the heap bookkeeping
// isn't worth it (microbench crossover is ~break-even at gene-scale depth, then
// 10-395x at 200x-8000x coverage). The fast path is output-identical, so this
// threshold is purely a performance gate, never a correctness one.
const LAYOUT_HEAP_MIN_READS = 20000

// Min-heap over a numeric key carrying a numeric value, backed by two parallel
// arrays (no per-node object allocation). Used by `partitionStartSorted` for
// the row-free queue (key=padded end, value=row index) and the lowest-free-row
// queue (key=value=row index).
class MinHeap {
  private keys: number[] = []
  private vals: number[] = []
  get size() {
    return this.keys.length
  }
  peekKey() {
    return this.keys[0]!
  }
  push(key: number, val: number) {
    const { keys, vals } = this
    let c = keys.length
    keys.push(key)
    vals.push(val)
    while (c > 0) {
      const p = (c - 1) >> 1
      if (keys[p]! <= keys[c]!) {
        break
      }
      const tk = keys[p]!
      keys[p] = keys[c]!
      keys[c] = tk
      const tv = vals[p]!
      vals[p] = vals[c]!
      vals[c] = tv
      c = p
    }
  }
  // remove and return the value whose key is smallest
  pop() {
    const { keys, vals } = this
    const m = keys.length - 1
    const top = vals[0]!
    keys[0] = keys[m]!
    vals[0] = vals[m]!
    keys.pop()
    vals.pop()
    const len = keys.length
    let c = 0
    for (;;) {
      const l = 2 * c + 1
      const r = l + 1
      let s = c
      if (l < len && keys[l]! < keys[s]!) {
        s = l
      }
      if (r < len && keys[r]! < keys[s]!) {
        s = r
      }
      if (s === c) {
        break
      }
      const tk = keys[s]!
      keys[s] = keys[c]!
      keys[c] = tk
      const tv = vals[s]!
      vals[s] = vals[c]!
      vals[c] = tv
      c = s
    }
    return top
  }
}

// Build the soft-clip iteration order: read indices sorted by expanded left
// edge (soft-clip-aware), genomic start as tiebreak. The placeRect algorithm
// (and the fast path below) need left-to-right ordering.
/**
 * Placement order for a plain pileup: genomic span, then read id. Returns
 * undefined when the array is already in that order, which is the normal case —
 * worker output is start-sorted, so the only reads that can be out of place are
 * ones sharing a start whose ids happen to descend. The caller then walks the
 * array directly and no permutation is allocated.
 *
 * The O(n) check is what makes the invariant free in the common case. Sorting
 * unconditionally costs ~23ms at 300k reads on a layout MobX recomputes on sort
 * toggles and resize; sorting only the equal-start runs was slower still
 * (~30ms — many small sorts plus the slicing beat one optimized sort).
 */
function buildCanonicalOrder(data: WorkerPileupData, numReads: number) {
  const { readPositions, readKeys } = data
  for (let i = 1; i < numReads; i++) {
    if (compareReadsCanonically(readPositions, readKeys, i - 1, i) > 0) {
      return Array.from({ length: numReads }, (_, k) => k).sort((a, b) =>
        compareReadsCanonically(readPositions, readKeys, a, b),
      )
    }
  }
  return undefined
}

function buildSoftclipOrder(
  data: WorkerPileupData,
  ext: ReadExtents,
  numReads: number,
) {
  const { readPositions, readKeys } = data
  return Array.from({ length: numReads }, (_, i) => i).sort(
    (a, b) =>
      ext.starts[a]! - ext.starts[b]! ||
      compareReadsCanonically(readPositions, readKeys, a, b),
  )
}

// Placement order that puts the widest features first — by on-screen extent
// (soft-clip aware), genomic start as a deterministic tiebreak. Placed
// first-fit-lowest-row, the widest features take the lowest rows so large
// alignments cluster at the top instead of interleaving with small ones (the
// LGVSyntenyDisplay default). Not start-monotone, so the placement loop uses the
// row-scan rather than the interval-partitioning fast path.
// 1 for every read whose CIGAR carries a skip, off the gap arrays the worker
// already ships, so no per-read flag crosses the boundary for this.
function readSplicedFlags(data: WorkerPileupData, numReads: number) {
  const { gapTypes, gapReadIndices } = data
  const spliced = new Uint8Array(numReads)
  for (let i = 0; i < gapTypes.length; i++) {
    if (gapTypes[i] === GAP_SKIP) {
      spliced[gapReadIndices[i]!] = 1
    }
  }
  return spliced
}

// Spliced reads take the lowest rows, each class in canonical order — so on
// RNA-seq the junction-spanning reads sit together at the top instead of
// interleaving with the unspliced majority. Not start-monotone, so the caller
// takes the row-scan path.
function buildSplicedFirstOrder(data: WorkerPileupData, numReads: number) {
  const { readPositions, readKeys } = data
  const spliced = readSplicedFlags(data, numReads)
  return Array.from({ length: numReads }, (_, i) => i).sort(
    (a, b) =>
      spliced[b]! - spliced[a]! ||
      compareReadsCanonically(readPositions, readKeys, a, b),
  )
}

function buildLargeFirstOrder(
  data: WorkerPileupData,
  ext: ReadExtents,
  numReads: number,
) {
  const { readPositions, readKeys } = data
  return Array.from({ length: numReads }, (_, i) => i).sort(
    (a, b) =>
      compareByExtentDesc(
        ext.starts[a]!,
        ext.ends[a]!,
        ext.starts[b]!,
        ext.ends[b]!,
      ) || compareReadsCanonically(readPositions, readKeys, a, b),
  )
}

/**
 * First-fit-lowest-row pileup layout via interval-partitioning min-heaps:
 * O(reads * log depth) instead of the placeRect row-scan's O(reads * depth).
 * Reads must be visited in non-decreasing start order (`order` = the soft-clip
 * or canonical placement order, or undefined when the array is already in it).
 * Returns null if a start ever goes
 * backwards, so the caller falls back to the row-scan. Output is identical to
 * repeated `placeRectCapped` for monotone input — same lowest-free-row choice
 * and the same `maxRows` overflow sentinel — verified in sortLayout.test.ts.
 */
function partitionStartSorted(
  data: WorkerPileupData,
  order: number[] | undefined,
  expansions: Map<number, { start: number; end: number }> | undefined,
  maxRows: number,
  readYs: Uint16Array,
): { maxY: number; truncated: boolean } | null {
  const { readPositions } = data
  const n = readYs.length
  const active = new MinHeap() // key=padded end, value=row index; frees lowest end
  const free = new MinHeap() // key=value=freed row index; reuses lowest index
  let nextNew = 0
  let truncated = false
  // -Infinity, not -1: a soft-clip-expanded start can go negative near a contig
  // start, and -1 would spuriously bail the whole region to the row-scan.
  let prevStart = Number.NEGATIVE_INFINITY
  for (let k = 0; k < n; k++) {
    const i = order ? order[k]! : k
    const exp = expansions?.get(i)
    const rs = readPositions[i * 2]!
    const start = exp ? Math.min(rs, exp.start) : rs
    if (start < prevStart) {
      return null
    }
    prevStart = start
    const re = readPositions[i * 2 + 1]!
    const paddedEnd = (exp ? Math.max(re, exp.end) : re) + 2

    // release every row whose last interval ends at/before this read's start
    while (active.size > 0 && active.peekKey() <= start) {
      const freed = active.pop()
      free.push(freed, freed)
    }

    if (free.size > 0) {
      const idx = free.pop()
      readYs[i] = idx
      active.push(paddedEnd, idx)
    } else if (nextNew < maxRows) {
      const idx = nextNew++
      readYs[i] = idx
      active.push(paddedEnd, idx)
    } else {
      readYs[i] = maxRows
      truncated = true
    }
  }
  return { maxY: nextNew, truncated }
}

/**
 * Compute pileup row layout for a single region. Returns
 * readYs[i] = pileup row for read i, maxY = total row count, and `truncated`
 * when `maxRows` clipped the stack.
 */
export function computeLayout(
  data: WorkerPileupData,
  showSoftClipping?: boolean,
  maxRows = Number.POSITIVE_INFINITY,
  largeFeaturesFirst?: boolean,
  splicedReadsFirst?: boolean,
) {
  const numReads = data.readKeys.length
  const expansions = showSoftClipping
    ? buildSoftclipExpansions(data)
    : undefined

  const readYs = new Uint16Array(numReads)

  // Largest-first sorts by extent (not start); soft-clip sorts by expanded left
  // edge; plain pileup is already in genomic (start) order from the worker. The
  // start-monotone cases can use the interval-partitioning fast path below;
  // largest-first can't (its order isn't start-sorted). Extents are precomputed
  // only when an ordering (or the row-scan below) will read them — the plain
  // start-monotone fast path reads readPositions directly and needs none.
  const needsExtents = largeFeaturesFirst || showSoftClipping
  const ext = needsExtents
    ? buildReadExtents(data, expansions, numReads)
    : undefined
  // The plain path gets a canonical order too. Worker output is start-sorted, so
  // array position already decides only among reads sharing a start — but that
  // is exactly the tie that made layout depend on arrival order, so it has to be
  // resolved by read identity rather than left to the emit order. Still
  // start-monotone, so the interval-partitioning fast path below applies.
  const order = splicedReadsFirst
    ? buildSplicedFirstOrder(data, numReads)
    : largeFeaturesFirst
      ? buildLargeFirstOrder(data, ext!, numReads)
      : showSoftClipping
        ? buildSoftclipOrder(data, ext!, numReads)
        : buildCanonicalOrder(data, numReads)

  if (
    !largeFeaturesFirst &&
    !splicedReadsFirst &&
    numReads >= LAYOUT_HEAP_MIN_READS
  ) {
    const fast = partitionStartSorted(data, order, expansions, maxRows, readYs)
    if (fast) {
      return { readYs, maxY: fast.maxY, truncated: fast.truncated }
    }
    // Non-monotone input: the row-scan below rewrites every readYs entry, so a
    // partially-filled array from the bailed fast path self-heals.
  }

  const rows: number[][] = []
  let truncated = false
  for (let k = 0; k < numReads; k++) {
    const i = order ? order[k]! : k
    // ext holds soft-clip-expanded extents; without it (plain pileup) the read's
    // raw genomic span is its extent.
    const start = ext ? ext.starts[i]! : data.readPositions[i * 2]!
    const end = ext ? ext.ends[i]! : data.readPositions[i * 2 + 1]!
    const y = placeRectCapped(rows, start, end, maxRows)
    readYs[i] = y
    truncated = truncated || y === maxRows
  }

  return { readYs, maxY: rows.length, truncated }
}

/**
 * Compute pileup row layout with a custom sort at `sortedBy.pos`. The reads the
 * sort ranks are placed first, in criterion order (each gets its own row since
 * they all collide pairwise at sortPos), then the rest fills gaps around them.
 * `partitionBySort` decides which reads those are.
 */
export function computeSortedLayout(
  data: WorkerPileupData,
  sortedBy: SortedBy,
  showSoftClipping?: boolean,
  maxRows = Number.POSITIVE_INFINITY,
) {
  const { readPositions } = data
  const numReads = data.readKeys.length
  const expansions = showSoftClipping
    ? buildSoftclipExpansions(data)
    : undefined

  const { ranked: overlapping, rest: nonOverlapping } = partitionBySort(
    data,
    sortedBy,
    data.sortTagValues,
  )
  // The gap-filling reads are placed after the sorted ones, and first-fit is
  // order-sensitive, so they need a canonical order for the same reason.
  nonOverlapping.sort((a, b) =>
    compareReadsCanonically(readPositions, data.readKeys, a, b),
  )

  // Soft-clip-expanded extents only when clips are shown; otherwise the read's
  // raw genomic span is its extent, read straight from readPositions (mirrors
  // computeLayout's plain path — no per-read Float64Array pair to allocate).
  const ext = expansions
    ? buildReadExtents(data, expansions, numReads)
    : undefined
  const readYs = new Uint16Array(numReads)
  const rows: number[][] = []
  let truncated = false
  // Sorted overlapping reads first (each gets its own row — they collide at
  // sortPos), then the rest fills gaps around them.
  const place = (ids: number[]) => {
    for (const i of ids) {
      const start = ext ? ext.starts[i]! : readPositions[i * 2]!
      const end = ext ? ext.ends[i]! : readPositions[i * 2 + 1]!
      const y = placeRectCapped(rows, start, end, maxRows)
      readYs[i] = y
      truncated = truncated || y === maxRows
    }
  }
  place(overlapping)
  place(nonOverlapping)
  return { readYs, maxY: rows.length, truncated }
}

// Region bounds a multi-region layout needs to locate the sort position's
// region and detect whether all regions share one refName.
export interface RegionBounds {
  refName: string
  start: number
  end: number
}

// The sort that applies to these regions, or undefined. Both layout paths go
// through it; see CLAUDE.md. No bounds to check against means the caller's sort
// stands.
function sortForRegions(
  sortedBy: SortedBy | undefined,
  regionIndices: number[],
  regions: ReadonlyMap<number, RegionBounds> | undefined,
) {
  if (!sortedBy || !regions) {
    return sortedBy
  }
  const refNames = new Set(regionIndices.map(i => regions.get(i)?.refName))
  const commonRefName = refNames.size === 1 ? [...refNames][0] : undefined
  return commonRefName === sortedBy.refName ? sortedBy : undefined
}

interface ReadExtent {
  start: number
  end: number
  refName: string | undefined
}

// Per-refName extent of everything being placed, accumulated by
// `extendRefNameSpan` and consumed by `refNameAxisShift`.
export type RefNameSpans = Map<string | undefined, { min: number; max: number }>

export function extendRefNameSpan(
  spans: RefNameSpans,
  refName: string | undefined,
  start: number,
  end: number,
) {
  const span = spans.get(refName)
  if (span) {
    if (start < span.min) {
      span.min = start
    }
    if (end > span.max) {
      span.max = end
    }
  } else {
    spans.set(refName, { min: start, max: end })
  }
}

/**
 * A shift that moves each refName onto its own disjoint span of the placement
 * axis.
 *
 * Regions on different refNames share the genomic coordinate axis — ctgA:1-50,000
 * and ctgB:1-6,000 both start at 1 — while occupying disjoint screen space, so
 * laying them out on that one axis wrongly collides them: each ctgB feature is
 * pushed below every ctgA feature covering the same bp, emptying the top rows of
 * ctgB's pileup. Identity when every region shares a refName (the single-region
 * and collapse-introns cases), so single-refName placement is untouched.
 *
 * Shared by pileup layout (`segmentExtentsByRefName`, shifting each read's
 * unioned extent) and chain layout (`mergeChains`, shifting each chain's
 * per-region bounds) so the two can't drift on the rule.
 */
export function refNameAxisShift(spans: RefNameSpans) {
  if (spans.size < 2) {
    return () => 0
  }
  // Lay the spans end to end in first-seen (≈ view) order, so placement stays
  // start-ascending overall and keeps placeRect's O(1) append fast path. The
  // 4bp gap clears placeRect's own 2bp end padding, so nothing on one refName
  // can ever collide with anything on the next.
  const offsets = new Map<string | undefined, number>()
  let cursor = 0
  for (const [refName, { min, max }] of spans) {
    offsets.set(refName, cursor - min)
    cursor += max - min + 4
  }
  return (refName: string | undefined) => offsets.get(refName) ?? 0
}

// A read only ever spans regions of one refName, so its unioned extent shifts as
// a unit onto that refName's segment of the placement axis.
function segmentExtentsByRefName(extents: Map<ReadKey, ReadExtent>) {
  const spans: RefNameSpans = new Map()
  for (const { start, end, refName } of extents.values()) {
    extendRefNameSpan(spans, refName, start, end)
  }
  const shiftFor = refNameAxisShift(spans)
  for (const extent of extents.values()) {
    const offset = shiftFor(extent.refName)
    extent.start += offset
    extent.end += offset
  }
}

/**
 * Compute layout across multiple regions, deduplicating reads that span
 * region boundaries by featureId. Returns rowMap<featureId, row> for
 * distributing rows back to each region's readYs array.
 *
 * `showSoftClipping` expands each read's extent by its soft clips (unioned
 * across the regions it appears in). `sortedBy` applies the localized sort at
 * `sortedBy.pos` — but only when every region shares one refName (the
 * collapse-introns case), where reads live on a single coordinate axis so the
 * sort can't false-match a same-numbered position on another chromosome.
 * Mixed-refName multi-region views keep plain dedup order.
 */
export function computeMultiRegionLayout({
  entries,
  regions,
  sortedBy,
  showSoftClipping,
  maxRows = Number.POSITIVE_INFINITY,
  largeFeaturesFirst,
  splicedReadsFirst,
}: {
  entries: [number, WorkerPileupData][]
  regions?: ReadonlyMap<number, RegionBounds>
  sortedBy?: SortedBy
  showSoftClipping?: boolean
  maxRows?: number
  largeFeaturesFirst?: boolean
  splicedReadsFirst?: boolean
}) {
  // Union extent per read (keyed by read key) across every region it appears
  // in, including soft-clip expansion — a read spanning a boundary gets one
  // extent, so it lands on one row. `orderedIds` collects them in first-seen
  // order and is canonicalized below.
  const extents = new Map<ReadKey, ReadExtent>()
  const orderedIds: ReadKey[] = []
  // A read is spliced if any region's copy of it carries a skip.
  const splicedIds = new Set<ReadKey>()
  for (const [idx, data] of entries) {
    const numReads = data.readKeys.length
    const exp = showSoftClipping ? buildSoftclipExpansions(data) : undefined
    const ext = buildReadExtents(data, exp, numReads)
    const refName = regions?.get(idx)?.refName
    const spliced = splicedReadsFirst
      ? readSplicedFlags(data, numReads)
      : undefined
    for (let i = 0; i < numReads; i++) {
      const id = data.readKeys[i]!
      if (spliced?.[i]) {
        splicedIds.add(id)
      }
      const start = ext.starts[i]!
      const end = ext.ends[i]!
      const cur = extents.get(id)
      if (cur) {
        if (start < cur.start) {
          cur.start = start
        }
        if (end > cur.end) {
          cur.end = end
        }
      } else {
        extents.set(id, { start, end, refName })
        orderedIds.push(id)
      }
    }
  }
  segmentExtentsByRefName(extents)

  // First-seen order is arrival order, which first-fit placement would bake into
  // the row assignment. Canonicalize on the unioned extent, then the id, so this
  // layout is a pure function of the read set like the single-region paths.
  const compareIdsCanonically = (a: ReadKey, b: ReadKey) => {
    const ea = extents.get(a)!
    const eb = extents.get(b)!
    return (
      ea.start - eb.start || ea.end - eb.end || (a < b ? -1 : a > b ? 1 : 0)
    )
  }
  orderedIds.sort(compareIdsCanonically)

  // `regions` twice over: the refName gate, and structurally to locate the
  // region holding the sort position.
  const activeSort = sortForRegions(
    sortedBy,
    entries.map(([idx]) => idx),
    regions,
  )

  let placementOrder = orderedIds
  let sortApplied = false
  if (activeSort && regions) {
    const sortPos = activeSort.pos
    // The region — and thus the data arrays — containing the sort position.
    const sortEntry = entries.find(([idx]) => {
      const r = regions.get(idx)
      return r !== undefined && r.start <= sortPos && r.end > sortPos
    })
    if (sortEntry) {
      const [, sData] = sortEntry
      // `rest` is dropped: this path already holds every read in dedup order
      // (`orderedIds`, deduplicated across regions), so it only needs to know
      // which reads the sort ranks and in what order.
      const { ranked } = partitionBySort(sData, activeSort, sData.sortTagValues)
      // Sorted overlapping reads first (each gets its own row — they all collide
      // at sortPos), then the rest in dedup order fills gaps around them.
      const overlappingIds = ranked.map(i => sData.readKeys[i]!)
      const overlappingSet = new Set(overlappingIds)
      placementOrder = [
        ...overlappingIds,
        ...orderedIds.filter(id => !overlappingSet.has(id)),
      ]
      sortApplied = true
    }
  }

  // The layout-order flags apply only when no explicit position sort took
  // effect (that sort wins). Spliced-first partitions the deduped ids; largest-
  // first sorts them by unioned on-screen extent, descending.
  if (!sortApplied && (splicedReadsFirst || largeFeaturesFirst)) {
    placementOrder = [...orderedIds].sort((a, b) => {
      const ea = extents.get(a)!
      const eb = extents.get(b)!
      return (
        (splicedReadsFirst
          ? Number(splicedIds.has(b)) - Number(splicedIds.has(a))
          : 0) ||
        (largeFeaturesFirst
          ? compareByExtentDesc(ea.start, ea.end, eb.start, eb.end)
          : 0) ||
        compareIdsCanonically(a, b)
      )
    })
  }

  const rowMap = new Map<ReadKey, number>()
  const rows: number[][] = []
  let truncated = false
  for (const id of placementOrder) {
    const { start, end } = extents.get(id)!
    const y = placeRectCapped(rows, start, end, maxRows)
    rowMap.set(id, y)
    truncated = truncated || y === maxRows
  }
  return { rowMap, maxY: rows.length, truncated }
}

/**
 * The worker's arrays plus a layout: a shallow clone carrying freshly-computed Y
 * arrays propagated from a per-read `readYs`. Every other typed array is shared
 * with the input.
 *
 * It returns a different type than it takes, and that is the tier boundary — a
 * `WorkerPileupData` in, a `LaidOutPileupData` out. The Y arrays exist only here
 * and in `withoutLayout`, so nothing upstream of a placement pass can pass off a
 * zero-filled one as a layout.
 *
 * Exported so chain-mode layout can reuse the same Y propagation.
 */
export function cloneWithLayout(
  data: WorkerPileupData,
  readYs: Uint16Array,
  maxY: number,
  clippedBy?: RowCapSource,
): LaidOutPileupData {
  const modificationYs = remapYs(data.modificationReadIndices, readYs)
  const numModifications = modificationYs.length
  let modFlatbush: Flatbush | undefined
  if (numModifications > 0) {
    modFlatbush = new Flatbush(numModifications)
    for (let i = 0; i < numModifications; i++) {
      const pos = data.modificationPositions[i]!
      const row = modificationYs[i]!
      modFlatbush.add(pos, row, pos, row)
    }
    modFlatbush.finish()
  }

  return {
    ...data,
    // The three row-derived line/tint passes a plain row placement produces
    // none of. Their own directories own the empty form; chain layout
    // (`cloneWithChainLayout`), the collapsed layout and
    // `attachLinkedReadLines` each spread their real records over it.
    ...emptyConnectingLinesUploadData(),
    ...emptyOverlapsUploadData(),
    ...emptyLinkedReadLinesUploadData(),
    readYs,
    gapYs: remapYs(data.gapReadIndices, readYs),
    mismatchYs: remapYs(data.mismatchReadIndices, readYs),
    interbaseYs: remapYs(data.interbaseReadIndices, readYs),
    modificationYs,
    softclipBaseYs: remapYs(data.softclipBaseReadIndices, readYs),
    perBaseQualYs: remapYs(data.perBaseQualReadIndices, readYs),
    perBaseLetterYs: remapYs(data.perBaseLetterReadIndices, readYs),
    maxY,
    clippedBy,
    modFlatbush,
  }
}

/**
 * The zero-row layout: every feature on row 0, no rows claimed, `maxY` 0.
 *
 * Two callers, and neither ran a placement pass. A region with no reads has
 * nothing to place, and a lane collapsed to its coverage band draws no pileup at
 * all — for which this is the whole point of the collapsed path, since it skips
 * `cloneWithLayout`'s per-feature `remapYs` gather and modification Flatbush.
 *
 * The arrays are still sized to their features rather than left empty: both
 * backends pack every pass of every region a section carries, indexing the `*Ys`
 * by feature, so a short array would be read past its end rather than skipped.
 */
export function withoutLayout(data: WorkerPileupData): LaidOutPileupData {
  return {
    ...data,
    ...emptyConnectingLinesUploadData(),
    ...emptyOverlapsUploadData(),
    ...emptyLinkedReadLinesUploadData(),
    readYs: new Uint16Array(data.readKeys.length),
    gapYs: new Uint16Array(data.gapReadIndices.length),
    mismatchYs: new Uint16Array(data.mismatchReadIndices.length),
    interbaseYs: new Uint16Array(data.interbaseReadIndices.length),
    modificationYs: new Uint16Array(data.modificationReadIndices.length),
    softclipBaseYs: new Uint16Array(data.softclipBaseReadIndices.length),
    perBaseQualYs: new Uint16Array(data.perBaseQualReadIndices.length),
    perBaseLetterYs: new Uint16Array(data.perBaseLetterReadIndices.length),
    maxY: 0,
  }
}

export interface PileupLayoutArgs {
  dataMap: ReadonlyMap<number, WorkerPileupData>
  sortedBy: SortedBy | undefined
  showSoftClipping: boolean | undefined
  regions?: ReadonlyMap<number, RegionBounds>
  // The cap AND which policy set it, so a clipped region can record what clipped
  // it. Defaults to no cap at all.
  rowCap?: RowCap
  largeFeaturesFirst?: boolean
  splicedReadsFirst?: boolean
}

// Per-region Y assignment before cloning: the raw data plus its filled readYs,
// the shared row count, and which cap clipped it (if any). Split out from
// `buildLaidOutPileupMap` so a count-only caller (fit-height row counting) can
// stop here and skip the per-feature `cloneWithLayout` — the dominant cost when
// per-base-quality/letter overlays balloon the *Ys arrays. `laid` is empty when
// `countOnly` (only `maxY` is meaningful then).
function computePileupRowLayout(
  {
    dataMap,
    sortedBy,
    showSoftClipping,
    regions,
    rowCap = UNCAPPED,
    largeFeaturesFirst,
    splicedReadsFirst,
  }: PileupLayoutArgs,
  countOnly: boolean,
): {
  empties: [number, WorkerPileupData][]
  laid: { idx: number; data: WorkerPileupData; readYs: Uint16Array }[]
  maxY: number
  clippedBy: RowCapSource | undefined
} {
  const maxRows = rowCap.rows
  // The cap's own label, recorded only when the cap actually bit — so
  // `clippedBy` reads as "this is what hid reads here", never as "this is the cap
  // it ran under".
  const clipped = (truncated: boolean) =>
    truncated ? rowCap.source : undefined
  const empties: [number, WorkerPileupData][] = []
  const withReads: [number, WorkerPileupData][] = []
  for (const [k, v] of dataMap) {
    if (v.readKeys.length === 0) {
      empties.push([k, v])
    } else {
      withReads.push([k, v])
    }
  }
  if (withReads.length === 0) {
    return { empties, laid: [], maxY: 0, clippedBy: undefined }
  }
  if (withReads.length === 1) {
    const [idx, data] = withReads[0]!
    const activeSort = sortForRegions(sortedBy, [idx], regions)
    const { readYs, maxY, truncated } = activeSort
      ? computeSortedLayout(data, activeSort, showSoftClipping, maxRows)
      : computeLayout(
          data,
          showSoftClipping,
          maxRows,
          largeFeaturesFirst,
          splicedReadsFirst,
        )
    return {
      empties,
      laid: countOnly ? [] : [{ idx, data, readYs }],
      maxY,
      clippedBy: clipped(truncated),
    }
  }
  const { rowMap, maxY, truncated } = computeMultiRegionLayout({
    entries: withReads,
    regions,
    sortedBy,
    showSoftClipping,
    maxRows,
    largeFeaturesFirst,
    splicedReadsFirst,
  })
  const laid = countOnly
    ? []
    : withReads.map(([idx, data]) => {
        const numReads = data.readKeys.length
        const readYs = new Uint16Array(numReads)
        for (let i = 0; i < numReads; i++) {
          readYs[i] = rowMap.get(data.readKeys[i]!)!
        }
        return { idx, data, readYs }
      })
  return { empties, laid, maxY, clippedBy: clipped(truncated) }
}

/**
 * Build a laid-out pileup map from raw fetched data: one entry per region of the
 * input, each carrying the Y arrays and `maxY` this pass derived.
 *
 * Intended to be called from a MobX-cached getter so layout recomputes only
 * when `rpcDataMap`, `sortedBy`, or `showSoftClipping` change.
 */
export function buildLaidOutPileupMap(
  args: PileupLayoutArgs,
): Map<number, LaidOutPileupData> {
  const { empties, laid, maxY, clippedBy } = computePileupRowLayout(args, false)
  const out = new Map<number, LaidOutPileupData>()
  for (const [k, v] of empties) {
    out.set(k, withoutLayout(v))
  }
  for (const { idx, data, readYs } of laid) {
    out.set(idx, cloneWithLayout(data, readYs, maxY, clippedBy))
  }
  return out
}

/**
 * Row count (maxY) the pileup layout would produce, without building the laid-
 * out clones. Used by the fit-to-height pass, which only needs the stack depth
 * to size reads — computing it via `buildLaidOutPileupMap` paid the full
 * per-feature clone (7 *Ys arrays + Flatbush per region) just to read `maxY`.
 */
export function pileupLayoutMaxY(args: PileupLayoutArgs): number {
  return computePileupRowLayout(args, true).maxY
}

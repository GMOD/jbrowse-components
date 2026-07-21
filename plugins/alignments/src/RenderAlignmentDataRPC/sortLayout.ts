import Flatbush from '@jbrowse/core/util/flatbush'
import { placeRect } from '@jbrowse/core/util/layouts/placeRect'

import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../shared/types.ts'

import type { SortedBy } from '../shared/types.ts'
import type { PileupDataResult } from './types'

const DELETION_CHAR = 42 // '*'

function sortByMapWithUnknownsLast(
  arr: number[],
  map: Map<number, number>,
  desc: boolean,
) {
  arr.sort((a, b) => {
    const aVal = map.get(a) ?? 0
    const bVal = map.get(b) ?? 0
    if (aVal !== 0 && bVal === 0) {
      return -1
    }
    if (aVal === 0 && bVal !== 0) {
      return 1
    }
    return desc ? bVal - aVal : aVal - bVal
  })
}

function buildSoftclipExpansions(data: PileupDataResult) {
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

/**
 * Get a read's effective [start,end) including any softclip expansion.
 */
function readExtent(
  data: PileupDataResult,
  i: number,
  expansions: Map<number, { start: number; end: number }> | undefined,
) {
  const start = data.readPositions[i * 2]!
  const end = data.readPositions[i * 2 + 1]!
  const exp = expansions?.get(i)
  return {
    start: exp ? Math.min(start, exp.start) : start,
    end: exp ? Math.max(end, exp.end) : end,
  }
}

// Per-read effective [start,end) (softclip-expanded when `expansions` present) as
// two parallel arrays, computed once. The order-building sort comparators compare
// extents O(n log n) times; reading these arrays avoids the `{start,end}` object
// `readExtent` would allocate on every one of those comparisons.
interface ReadExtents {
  starts: Float64Array
  ends: Float64Array
}
function buildReadExtents(
  data: PileupDataResult,
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
  data: PileupDataResult,
  type: SortedBy['type'],
  sortPos: number,
): { map: Map<number, number>; desc: boolean } | undefined {
  let result: { map: Map<number, number>; desc: boolean } | undefined
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
      if (gapTypes[i] === 0) {
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
  } else if (['insertion', 'softclip', 'hardclip'].includes(type)) {
    const targetType =
      type === 'insertion'
        ? INTERBASE_INSERTION
        : type === 'softclip'
          ? INTERBASE_SOFTCLIP
          : INTERBASE_HARDCLIP
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
  data: PileupDataResult,
  sortedBy: SortedBy,
  sortTagValues: string[] | undefined,
) {
  const { type, pos: sortPos } = sortedBy
  const keyMap = buildSortKeyMap(data, type, sortPos)
  if (keyMap) {
    sortByMapWithUnknownsLast(overlapping, keyMap.map, keyMap.desc)
  } else if (type === 'position') {
    const { readPositions } = data
    overlapping.sort((a, b) => readPositions[a * 2]! - readPositions[b * 2]!)
  } else if (type === 'strand') {
    const { readStrands } = data
    overlapping.sort((a, b) => readStrands[b]! - readStrands[a]!)
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
        (a, b) => Number(sortTagValues[b] ?? 0) - Number(sortTagValues[a] ?? 0),
      )
    } else {
      overlapping.sort((a, b) =>
        (sortTagValues[b] ?? '').localeCompare(sortTagValues[a] ?? ''),
      )
    }
  }
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
function buildSoftclipOrder(
  data: PileupDataResult,
  ext: ReadExtents,
  numReads: number,
) {
  return Array.from({ length: numReads }, (_, i) => i).sort((a, b) =>
    ext.starts[a] !== ext.starts[b]
      ? ext.starts[a]! - ext.starts[b]!
      : (data.readPositions[a * 2] ?? 0) - (data.readPositions[b * 2] ?? 0),
  )
}

// Placement order that puts the widest features first — by on-screen extent
// (soft-clip aware), genomic start as a deterministic tiebreak. Placed
// first-fit-lowest-row, the widest features take the lowest rows so large
// alignments cluster at the top instead of interleaving with small ones (the
// LGVSyntenyDisplay default). Not start-monotone, so the placement loop uses the
// row-scan rather than the interval-partitioning fast path.
function buildLargeFirstOrder(ext: ReadExtents, numReads: number) {
  return Array.from({ length: numReads }, (_, i) => i).sort((a, b) =>
    compareByExtentDesc(
      ext.starts[a]!,
      ext.ends[a]!,
      ext.starts[b]!,
      ext.ends[b]!,
    ),
  )
}

/**
 * First-fit-lowest-row pileup layout via interval-partitioning min-heaps:
 * O(reads * log depth) instead of the placeRect row-scan's O(reads * depth).
 * Reads must be visited in non-decreasing start order (`order` = soft-clip sort,
 * or genomic order when `order` is undefined). Returns null if a start ever goes
 * backwards, so the caller falls back to the row-scan. Output is identical to
 * repeated `placeRectCapped` for monotone input — same lowest-free-row choice
 * and the same `maxRows` overflow sentinel — verified in sortLayout.test.ts.
 */
function partitionStartSorted(
  data: PileupDataResult,
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
  data: PileupDataResult,
  showSoftClipping?: boolean,
  maxRows = Number.POSITIVE_INFINITY,
  largeFeaturesFirst?: boolean,
) {
  const numReads = data.readIds.length
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
  const order = largeFeaturesFirst
    ? buildLargeFirstOrder(ext!, numReads)
    : showSoftClipping
      ? buildSoftclipOrder(data, ext!, numReads)
      : undefined

  if (!largeFeaturesFirst && numReads >= LAYOUT_HEAP_MIN_READS) {
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
 * Compute pileup row layout with a custom sort at `sortedBy.pos`. Reads
 * overlapping the sort position are placed first in sort-criterion
 * order (each gets its own row since they all collide pairwise at
 * sortPos), then non-overlapping reads fill gaps around them.
 */
export function computeSortedLayout(
  data: PileupDataResult,
  sortedBy: SortedBy,
  showSoftClipping?: boolean,
  maxRows = Number.POSITIVE_INFINITY,
) {
  const { readPositions } = data
  const numReads = data.readIds.length
  const { pos: sortPos } = sortedBy
  const expansions = showSoftClipping
    ? buildSoftclipExpansions(data)
    : undefined

  const overlapping: number[] = []
  const nonOverlapping: number[] = []
  for (let i = 0; i < numReads; i++) {
    const start = readPositions[i * 2]!
    const end = readPositions[i * 2 + 1]!
    if (start <= sortPos && end > sortPos) {
      overlapping.push(i)
    } else {
      nonOverlapping.push(i)
    }
  }

  sortOverlappingByIndex(overlapping, data, sortedBy, data.sortTagValues)

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

interface ReadExtent {
  start: number
  end: number
  refName: string | undefined
}

/**
 * Shift each refName's reads onto its own disjoint span of the placement axis.
 *
 * Regions on different refNames share the genomic coordinate axis — ctgA:1-50,000
 * and ctgB:1-6,000 both start at 1 — while occupying disjoint screen space, so
 * laying them out on that one axis wrongly collides them: each ctgB read is
 * pushed below every ctgA read covering the same bp, emptying the top rows of
 * ctgB's pileup. A read only ever spans regions of one refName, so its unioned
 * extent shifts as a unit. A no-op when every region shares a refName (the
 * single-region and collapse-introns cases).
 */
function segmentExtentsByRefName(extents: Map<string, ReadExtent>) {
  const spans = new Map<
    string | undefined,
    { min: number; max: number; offset: number }
  >()
  for (const { start, end, refName } of extents.values()) {
    const span = spans.get(refName)
    if (span) {
      if (start < span.min) {
        span.min = start
      }
      if (end > span.max) {
        span.max = end
      }
    } else {
      spans.set(refName, { min: start, max: end, offset: 0 })
    }
  }
  if (spans.size > 1) {
    // Lay the spans end to end in first-seen (≈ view) order, so placement stays
    // start-ascending overall and keeps placeRect's O(1) append fast path. The
    // 4bp gap clears placeRect's own 2bp end padding, so no read of one refName
    // can ever collide with a read of the next.
    let cursor = 0
    for (const span of spans.values()) {
      span.offset = cursor - span.min
      cursor += span.max - span.min + 4
    }
    for (const extent of extents.values()) {
      const { offset } = spans.get(extent.refName)!
      extent.start += offset
      extent.end += offset
    }
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
}: {
  entries: [number, PileupDataResult][]
  regions?: ReadonlyMap<number, RegionBounds>
  sortedBy?: SortedBy
  showSoftClipping?: boolean
  maxRows?: number
  largeFeaturesFirst?: boolean
}) {
  // Union extent per read (keyed by featureId) across every region it appears
  // in, including soft-clip expansion — a read spanning a boundary gets one
  // extent, so it lands on one row. `orderedIds` keeps first-seen (≈ genomic)
  // order for the default placement.
  const extents = new Map<string, ReadExtent>()
  const orderedIds: string[] = []
  for (const [idx, data] of entries) {
    const exp = showSoftClipping ? buildSoftclipExpansions(data) : undefined
    const refName = regions?.get(idx)?.refName
    for (let i = 0; i < data.readIds.length; i++) {
      const id = data.readIds[i]!
      const { start, end } = readExtent(data, i, exp)
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

  const refNames = regions
    ? [...new Set(entries.map(([idx]) => regions.get(idx)?.refName))]
    : []
  const commonRefName = refNames.length === 1 ? refNames[0] : undefined

  let placementOrder = orderedIds
  let sortApplied = false
  if (sortedBy && regions && commonRefName === sortedBy.refName) {
    const sortPos = sortedBy.pos
    // The region — and thus the data arrays — containing the sort position.
    const sortEntry = entries.find(([idx]) => {
      const r = regions.get(idx)
      return r !== undefined && r.start <= sortPos && r.end > sortPos
    })
    if (sortEntry) {
      const [, sData] = sortEntry
      const overlapping: number[] = []
      for (let i = 0; i < sData.readIds.length; i++) {
        const start = sData.readPositions[i * 2]!
        const end = sData.readPositions[i * 2 + 1]!
        if (start <= sortPos && end > sortPos) {
          overlapping.push(i)
        }
      }
      sortOverlappingByIndex(overlapping, sData, sortedBy, sData.sortTagValues)
      // Sorted overlapping reads first (each gets its own row — they all collide
      // at sortPos), then the rest in dedup order fills gaps around them.
      const overlappingIds = overlapping.map(i => sData.readIds[i]!)
      const overlappingSet = new Set(overlappingIds)
      placementOrder = [
        ...overlappingIds,
        ...orderedIds.filter(id => !overlappingSet.has(id)),
      ]
      sortApplied = true
    }
  }

  // Largest-first only when no explicit position sort took effect (that sort
  // wins). Sorts the deduped ids by unioned on-screen extent, descending.
  if (!sortApplied && largeFeaturesFirst) {
    placementOrder = [...orderedIds].sort((a, b) => {
      const ea = extents.get(a)!
      const eb = extents.get(b)!
      return compareByExtentDesc(ea.start, ea.end, eb.start, eb.end)
    })
  }

  const rowMap = new Map<string, number>()
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
 * Shallow clone of a PileupDataResult with freshly-computed Y arrays
 * propagated from a per-read readYs. All other typed arrays are shared.
 *
 * Exported so chain-mode layout can reuse the same Y propagation.
 */
export function cloneWithLayout(
  data: PileupDataResult,
  readYs: Uint16Array,
  maxY: number,
  truncated = false,
): PileupDataResult {
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
    readYs,
    gapYs: remapYs(data.gapReadIndices, readYs),
    mismatchYs: remapYs(data.mismatchReadIndices, readYs),
    interbaseYs: remapYs(data.interbaseReadIndices, readYs),
    modificationYs,
    softclipBaseYs: remapYs(data.softclipBaseReadIndices, readYs),
    perBaseQualYs: remapYs(data.perBaseQualReadIndices, readYs),
    perBaseLetterYs: remapYs(data.perBaseLetterReadIndices, readYs),
    maxY,
    truncated,
    modFlatbush,
  }
}

export interface PileupLayoutArgs {
  dataMap: ReadonlyMap<number, PileupDataResult>
  sortedBy: SortedBy | undefined
  showSoftClipping: boolean | undefined
  regions?: ReadonlyMap<number, RegionBounds>
  maxRows?: number
  largeFeaturesFirst?: boolean
}

// Per-region Y assignment before cloning: the raw data plus its filled readYs,
// the shared row count, and the truncation flag. Split out from
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
    maxRows = Number.POSITIVE_INFINITY,
    largeFeaturesFirst,
  }: PileupLayoutArgs,
  countOnly: boolean,
): {
  empties: [number, PileupDataResult][]
  laid: { idx: number; data: PileupDataResult; readYs: Uint16Array }[]
  maxY: number
  truncated: boolean
} {
  const empties: [number, PileupDataResult][] = []
  const withReads: [number, PileupDataResult][] = []
  for (const [k, v] of dataMap) {
    if (v.readIds.length === 0) {
      empties.push([k, v])
    } else {
      withReads.push([k, v])
    }
  }
  if (withReads.length === 0) {
    return { empties, laid: [], maxY: 0, truncated: false }
  }
  if (withReads.length === 1) {
    const [idx, data] = withReads[0]!
    const { readYs, maxY, truncated } = sortedBy
      ? computeSortedLayout(data, sortedBy, showSoftClipping, maxRows)
      : computeLayout(data, showSoftClipping, maxRows, largeFeaturesFirst)
    return {
      empties,
      laid: countOnly ? [] : [{ idx, data, readYs }],
      maxY,
      truncated,
    }
  }
  const { rowMap, maxY, truncated } = computeMultiRegionLayout({
    entries: withReads,
    regions,
    sortedBy,
    showSoftClipping,
    maxRows,
    largeFeaturesFirst,
  })
  const laid = countOnly
    ? []
    : withReads.map(([idx, data]) => {
        const numReads = data.readIds.length
        const readYs = new Uint16Array(numReads)
        for (let i = 0; i < numReads; i++) {
          readYs[i] = rowMap.get(data.readIds[i]!)!
        }
        return { idx, data, readYs }
      })
  return { empties, laid, maxY, truncated }
}

/**
 * Build a laid-out pileup map from raw fetched data. The raw map's entries
 * keep zero-filled Y arrays (from the worker); this returns a parallel map
 * whose entries have Y arrays and maxY derived from pileup layout.
 *
 * Intended to be called from a MobX-cached getter so layout recomputes only
 * when `rpcDataMap`, `sortedBy`, or `showSoftClipping` change.
 */
export function buildLaidOutPileupMap(
  args: PileupLayoutArgs,
): Map<number, PileupDataResult> {
  const { empties, laid, maxY, truncated } = computePileupRowLayout(args, false)
  const out = new Map<number, PileupDataResult>()
  for (const [k, v] of empties) {
    out.set(k, v)
  }
  for (const { idx, data, readYs } of laid) {
    out.set(idx, cloneWithLayout(data, readYs, maxY, truncated))
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

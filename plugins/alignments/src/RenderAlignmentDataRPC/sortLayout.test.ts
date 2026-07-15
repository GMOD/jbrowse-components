import {
  computeLayout,
  computeMultiRegionLayout,
  computeSortedLayout,
} from './sortLayout.ts'
import { INTERBASE_SOFTCLIP } from '../shared/types.ts'

import type { PileupDataResult } from './types.ts'
import type { SortedBy } from '../shared/types.ts'

interface Read {
  start: number
  end: number
  baseAtSortPos?: string
  tagValue?: string
  // A soft clip at genomic `pos` of `length` bp (left clip when pos <= start).
  softclip?: { pos: number; length: number }
}

function makePileupData(opts: {
  regionStart: number
  reads: Read[]
  sortPos?: number
  // Distinguishes reads across regions in multi-region tests; the same prefix+i
  // in two regions is treated as one boundary-spanning read (dedup by id).
  idPrefix?: string
}): PileupDataResult {
  const { reads, sortPos, idPrefix = 'id' } = opts
  const numReads = reads.length
  const hasAnyTagValue = reads.some(r => r.tagValue !== undefined)
  const sortTagValues = hasAnyTagValue
    ? reads.map(r => r.tagValue ?? '')
    : undefined

  const readPositions = new Uint32Array(numReads * 2)
  const readIds: string[] = []
  const readNames: string[] = []
  for (const [i, r] of reads.entries()) {
    readPositions[i * 2] = r.start
    readPositions[i * 2 + 1] = r.end
    readIds.push(`${idPrefix}${i}`)
    readNames.push(`${idPrefix}${i}`)
  }

  const mismatchEntries: { readIdx: number; pos: number; base: number }[] = []
  if (sortPos !== undefined) {
    for (const [i, r] of reads.entries()) {
      if (r.baseAtSortPos) {
        mismatchEntries.push({
          readIdx: i,
          pos: sortPos,
          base: r.baseAtSortPos.charCodeAt(0),
        })
      }
    }
  }

  const numMismatches = mismatchEntries.length
  const mismatchPositions = new Uint32Array(numMismatches)
  const mismatchReadIndices = new Uint32Array(numMismatches)
  const mismatchBases = new Uint8Array(numMismatches)
  for (let i = 0; i < numMismatches; i++) {
    const e = mismatchEntries[i]!
    mismatchPositions[i] = e.pos
    mismatchReadIndices[i] = e.readIdx
    mismatchBases[i] = e.base
  }

  const softclipEntries = reads.flatMap((r, i) =>
    r.softclip ? [{ readIdx: i, ...r.softclip }] : [],
  )
  const numSoftclips = softclipEntries.length
  const interbasePositions = new Uint32Array(numSoftclips)
  const interbaseLengths = new Uint16Array(numSoftclips)
  const interbaseTypes = new Uint8Array(numSoftclips)
  const interbaseReadIndices = new Uint32Array(numSoftclips)
  for (let i = 0; i < numSoftclips; i++) {
    const e = softclipEntries[i]!
    interbasePositions[i] = e.pos
    interbaseLengths[i] = e.length
    interbaseTypes[i] = INTERBASE_SOFTCLIP
    interbaseReadIndices[i] = e.readIdx
  }

  return {
    readIds,
    readNames,
    readPositions,
    readYs: new Uint16Array(numReads),
    readFlags: new Uint16Array(numReads),
    readMapqs: new Uint8Array(numReads),
    readInsertSizes: new Float32Array(numReads),
    readPairOrientations: new Uint8Array(numReads),
    readStrands: new Int8Array(numReads),
    readInterchrom: new Uint8Array(numReads),
    readTagColors: new Uint32Array(0),
    segmentPositions: new Uint32Array(0),
    segmentReadIndices: new Uint32Array(0),
    segmentEdgeFlags: new Uint8Array(0),
    numSegments: 0,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapLengths: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapReadIndices: new Uint32Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions,
    mismatchYs: new Uint16Array(numMismatches),
    mismatchBases,
    mismatchStrands: new Int8Array(numMismatches),
    mismatchReadIndices,
    mismatchFrequencies: new Uint8Array(numMismatches),
    mismatchQuals: new Uint8Array(numMismatches),
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    softclipBaseReadIndices: new Uint32Array(0),
    interbasePositions,
    interbaseYs: new Uint16Array(numSoftclips),
    interbaseLengths,
    interbaseTypes,
    interbaseReadIndices,
    interbaseSequences: [],
    interbaseFrequencies: new Uint8Array(numSoftclips),
    coverageDepths: new Float32Array(0),
    coverageFwdDepths: new Float32Array(0),
    coverageRevDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartPos: 0,
    coverageStatsBinSize: 1,
    coverageStatsMins: new Float32Array(0),
    coverageStatsMaxs: new Float32Array(0),
    coverageStatsSums: new Float64Array(0),
    coverageStatsSumSqs: new Float64Array(0),
    coverageBinSize: 1,
    coverageGpuBinCount: 0,
    coveragePackedBuffer: new ArrayBuffer(0),
    snpPositions: new Uint32Array(0),
    snpYOffsets: new Float32Array(0),
    snpHeights: new Float32Array(0),
    snpColorTypes: new Uint8Array(0),
    snpRelDepths: new Float32Array(0),
    snpPackedBuffer: new ArrayBuffer(0),
    interbaseCovPositions: new Uint32Array(0),
    interbaseCovYOffsets: new Float32Array(0),
    interbaseCovHeights: new Float32Array(0),
    interbaseCovColorTypes: new Uint8Array(0),
    interbaseMaxCount: 0,
    interbasePackedBuffer: new ArrayBuffer(0),
    indicatorPositions: new Uint32Array(0),
    indicatorColorTypes: new Uint8Array(0),
    indicatorPackedBuffer: new ArrayBuffer(0),
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint32Array(0),
    modificationReadIndices: new Uint32Array(0),
    perBaseQualPositions: new Uint32Array(0),
    perBaseQualYs: new Uint16Array(0),
    perBaseQualScores: new Uint8Array(0),
    perBaseQualReadIndices: new Uint32Array(0),
    perBaseLetterPositions: new Uint32Array(0),
    perBaseLetterYs: new Uint16Array(0),
    perBaseLetterBases: new Uint8Array(0),
    perBaseLetterReadIndices: new Uint32Array(0),
    modCovPositions: new Uint32Array(0),
    modCovYOffsets: new Float32Array(0),
    modCovHeights: new Float32Array(0),
    modCovColors: new Uint32Array(0),
    modCovRelDepths: new Float32Array(0),
    modCovPackedBuffer: new ArrayBuffer(0),
    sashimiX1: new Uint32Array(0),
    sashimiX2: new Uint32Array(0),
    sashimiColorTypes: new Uint8Array(0),
    sashimiCounts: new Uint32Array(0),
    numInsertions: 0,
    numSoftclips,
    numHardclips: 0,
    detectedModifications: [],
    maxY: 0,
    sortTagValues,
    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
    overlapPositions: new Uint32Array(0),
    overlapYs: new Uint16Array(0),
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
  }
}

function makeSortedBy(pos: number, type = 'basePair', tag?: string): SortedBy {
  return { type, pos, refName: 'chr1', assemblyName: 'a', tag }
}

/**
 * Verify that readYs assigns a valid non-overlapping layout: no two reads
 * in the same row have overlapping [start,end] extents.
 */
function assertNonOverlappingLayout(
  data: PileupDataResult,
  readYs: Uint16Array,
) {
  const { readPositions } = data
  const numReads = data.readIds.length
  const byRow = new Map<number, { start: number; end: number; idx: number }[]>()
  for (let i = 0; i < numReads; i++) {
    const row = readYs[i]!
    const start = readPositions[i * 2]!
    const end = readPositions[i * 2 + 1]!
    if (!byRow.has(row)) {
      byRow.set(row, [])
    }
    byRow.get(row)!.push({ start, end, idx: i })
  }
  for (const [row, items] of byRow) {
    items.sort((a, b) => a.start - b.start)
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]!
      const cur = items[i]!
      if (cur.start < prev.end) {
        throw new Error(
          `overlap in row ${row}: read ${prev.idx} [${prev.start},${prev.end}) vs read ${cur.idx} [${cur.start},${cur.end})`,
        )
      }
    }
  }
}

describe('computeLayout', () => {
  test('empty data returns maxY 0', () => {
    const data = makePileupData({ regionStart: 0, reads: [] })
    const { maxY } = computeLayout(data)
    expect(maxY).toBe(0)
  })

  describe('softclip expansion direction', () => {
    // A read whose alignment begins to the left of the region (its readPosition
    // start is clamped to regionStart) with a left soft clip must expand its
    // layout extent leftward, not rightward.
    test('left clip on a read starting before the region expands leftward', () => {
      // readA aligns [80,200] but is clamped to [100,200]; a 30bp left clip
      // sits at genomic 80, covering [50,80). readB occupies [40,75], which
      // overlaps readA's expanded left edge — so they cannot share a row.
      const data = makePileupData({
        regionStart: 100,
        reads: [
          { start: 100, end: 200, softclip: { pos: 80, length: 30 } },
          { start: 40, end: 75 },
        ],
      })
      const { readYs, maxY } = computeLayout(data, true)
      expect(readYs[0]).not.toBe(readYs[1])
      expect(maxY).toBe(2)
    })

    test('left clip wholly within the region still expands leftward', () => {
      const data = makePileupData({
        regionStart: 0,
        reads: [
          { start: 100, end: 200, softclip: { pos: 100, length: 30 } },
          { start: 40, end: 75 },
        ],
      })
      const { readYs, maxY } = computeLayout(data, true)
      expect(readYs[0]).not.toBe(readYs[1])
      expect(maxY).toBe(2)
    })

    test('right clip expands rightward', () => {
      const data = makePileupData({
        regionStart: 0,
        reads: [
          { start: 100, end: 200, softclip: { pos: 200, length: 30 } },
          { start: 210, end: 250 },
        ],
      })
      const { readYs, maxY } = computeLayout(data, true)
      // readA expands to [100,230], colliding with readB [210,250]
      expect(readYs[0]).not.toBe(readYs[1])
      expect(maxY).toBe(2)
    })
  })

  test('non-overlapping reads share a row', () => {
    const data = makePileupData({
      regionStart: 0,
      reads: [
        { start: 100, end: 200 },
        { start: 300, end: 400 },
      ],
    })
    const { readYs, maxY } = computeLayout(data)
    expect(readYs[0]).toBe(readYs[1])
    expect(maxY).toBe(1)
  })

  test('overlapping reads go to different rows', () => {
    const data = makePileupData({
      regionStart: 0,
      reads: [
        { start: 100, end: 300 },
        { start: 200, end: 400 },
      ],
    })
    const { readYs, maxY } = computeLayout(data)
    expect(readYs[0]).not.toBe(readYs[1])
    expect(maxY).toBe(2)
  })

  test('maxRows caps the stack and flags truncation', () => {
    // Five reads all overlapping the same column would need 5 rows; cap at 3.
    const data = makePileupData({
      regionStart: 0,
      reads: [
        { start: 100, end: 400 },
        { start: 100, end: 400 },
        { start: 100, end: 400 },
        { start: 100, end: 400 },
        { start: 100, end: 400 },
      ],
    })
    const { readYs, maxY, truncated } = computeLayout(data, false, 3)
    expect(maxY).toBe(3)
    expect(truncated).toBe(true)
    // Overflow reads collapse to the sentinel row (=== maxRows), and no row
    // index exceeds it so the Uint16 store never wraps.
    for (const y of readYs) {
      expect(y).toBeLessThanOrEqual(3)
    }
    expect([...readYs].filter(y => y === 3).length).toBe(2)
  })

  test('maxRows leaves a fitting stack untruncated', () => {
    const data = makePileupData({
      regionStart: 0,
      reads: [
        { start: 100, end: 400 },
        { start: 100, end: 400 },
      ],
    })
    const { maxY, truncated } = computeLayout(data, false, 3)
    expect(maxY).toBe(2)
    expect(truncated).toBe(false)
  })
})

describe('computeLayout largeFeaturesFirst', () => {
  // A small read starts before a large one that overlaps it. Default (genomic
  // start) order puts the small read in row 0 and the large one in row 1;
  // largest-first flips that so the wide feature takes the lowest row.
  const data = () =>
    makePileupData({
      regionStart: 0,
      reads: [
        { start: 0, end: 10 }, // id0 small
        { start: 5, end: 100 }, // id1 large, overlaps id0
      ],
    })

  test('default order places the small read first (row 0)', () => {
    const { readYs, maxY } = computeLayout(data())
    expect(readYs[0]).toBe(0)
    expect(readYs[1]).toBe(1)
    expect(maxY).toBe(2)
  })

  test('largest-first places the wide read in the lowest row', () => {
    const { readYs, maxY } = computeLayout(data(), false, undefined, true)
    expect(readYs[1]).toBe(0) // large
    expect(readYs[0]).toBe(1) // small
    expect(maxY).toBe(2)
  })

  test('a small non-overlapping read fills the gap beside the wide read', () => {
    // Wide read [0,100] in row 0; two small reads to its "side" can't fit (they
    // overlap it) so they stack, but a read past its end shares row 0.
    const d = makePileupData({
      regionStart: 0,
      reads: [
        { start: 10, end: 20 }, // id0 small, overlaps wide
        { start: 0, end: 100 }, // id1 wide
        { start: 150, end: 200 }, // id2 small, past the wide read's end
      ],
    })
    const { readYs, maxY } = computeLayout(d, false, undefined, true)
    expect(readYs[1]).toBe(0) // wide read first, row 0
    expect(readYs[2]).toBe(0) // non-overlapping small fills row 0 gap
    expect(readYs[0]).toBe(1) // overlapping small stacks above
    expect(maxY).toBe(2)
  })
})

// Above LAYOUT_HEAP_MIN_READS, computeLayout switches from the placeRect
// row-scan to the interval-partitioning heaps. The two paths must produce an
// identical first-fit-lowest-row layout. The small-input tests above pin the
// row-scan; these tests pin the heap path independently: a valid layout
// (no two reads in one row overlap) packed optimally (maxY equals the peak
// number of simultaneously-overlapping reads, which first-fit achieves).
describe('computeLayout fast path (interval partitioning)', () => {
  // peak count of reads whose padded [start, end+2) intervals overlap a point;
  // an end frees its row when paddedEnd <= start, so process ends before starts
  // at an equal coordinate (delta -1 sorts before +1).
  function peakPaddedDepth(data: PileupDataResult) {
    const n = data.readIds.length
    const events: [number, number][] = []
    for (let i = 0; i < n; i++) {
      events.push([data.readPositions[i * 2]!, 1])
      events.push([data.readPositions[i * 2 + 1]! + 2, -1])
    }
    events.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
    let depth = 0
    let peak = 0
    for (const [, delta] of events) {
      depth += delta
      peak = Math.max(peak, depth)
    }
    return peak
  }

  // deterministic start-sorted deep-coverage reads (mirrors the worker output
  // order: BAM is coordinate-sorted)
  function makeDeepReads(numReads: number, span: number, readLen: number) {
    let s = 99
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const starts = Array.from({ length: numReads }, () =>
      Math.floor(rnd() * span),
    ).sort((a, b) => a - b)
    return starts.map(start => ({
      start,
      end: start + readLen + Math.floor(rnd() * 40),
    }))
  }

  test('large start-sorted layout is valid and optimally packed', () => {
    const reads = makeDeepReads(25000, 5000, 150) // ~750x deep
    const data = makePileupData({ regionStart: 0, reads })
    const { readYs, maxY } = computeLayout(data)
    assertNonOverlappingLayout(data, readYs)
    expect(maxY).toBe(peakPaddedDepth(data))
  })

  test('large layout honors maxRows with the overflow sentinel', () => {
    const reads = makeDeepReads(25000, 5000, 150)
    const data = makePileupData({ regionStart: 0, reads })
    const cap = 50
    const uncapped = computeLayout(data)
    expect(uncapped.maxY).toBeGreaterThan(cap) // this region really overflows
    const { readYs, maxY, truncated } = computeLayout(data, false, cap)
    expect(maxY).toBe(cap)
    expect(truncated).toBe(true)
    for (const y of readYs) {
      expect(y).toBeLessThanOrEqual(cap)
    }
    // reads that fit (row < cap) keep the same row as the uncapped layout —
    // capping only pushes overflow reads to the sentinel, never reshuffles
    for (let i = 0; i < readYs.length; i++) {
      if (uncapped.readYs[i]! < cap) {
        expect(readYs[i]).toBe(uncapped.readYs[i])
      }
    }
  })

  test('non-monotone input above the threshold falls back and stays valid', () => {
    // worker output is normally start-sorted; if it ever isn't, the heap path
    // bails (start goes backwards) to the row-scan. Reverse the order to force
    // the fallback — the result must still be a valid layout. (first-fit isn't
    // guaranteed minimal-row for unsorted input, so maxY isn't asserted here.)
    const reads = makeDeepReads(25000, 5000, 150).reverse()
    const data = makePileupData({ regionStart: 0, reads })
    const { readYs } = computeLayout(data)
    assertNonOverlappingLayout(data, readYs)
  })

  // Independent first-fit-lowest-row reference over padded (end+2) intervals in
  // monotone start order. Deliberately does NOT use placeRect, so a shared bug
  // can't hide the divergence — this is the spec the heap path must match.
  function refFirstFit(data: PileupDataResult, maxRows: number) {
    const { readPositions } = data
    const n = data.readIds.length
    const rowEnds: number[] = [] // rowEnds[r] = last padded end placed in row r
    const ys = new Uint16Array(n)
    let truncated = false
    for (let i = 0; i < n; i++) {
      const start = readPositions[i * 2]!
      const paddedEnd = readPositions[i * 2 + 1]! + 2
      let placed = -1
      for (let r = 0; r < rowEnds.length; r++) {
        if (rowEnds[r]! <= start) {
          placed = r
          break
        }
      }
      if (placed >= 0) {
        ys[i] = placed
        rowEnds[placed] = paddedEnd
      } else if (rowEnds.length < maxRows) {
        ys[i] = rowEnds.length
        rowEnds.push(paddedEnd)
      } else {
        ys[i] = maxRows
        truncated = true
      }
    }
    return { ys, maxY: rowEnds.length, truncated }
  }

  // The whole premise of the fast path is byte-identical output to the row-scan.
  // Fuzz it against the independent reference across read shapes and caps; every
  // input here is ≥ LAYOUT_HEAP_MIN_READS so the heap path is the one exercised.
  test('fast path output is byte-identical to first-fit reference (fuzz)', () => {
    let s = 0xc0ffee
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const caps = [Number.POSITIVE_INFINITY, 1, 8, 50, 200]
    for (let trial = 0; trial < 40; trial++) {
      const numReads = 20000 + Math.floor(rnd() * 4000)
      const span = 1 + Math.floor(rnd() * 6000) // tiny spans force deep ties
      const readLen = 1 + Math.floor(rnd() * 250)
      const reads = makeDeepReads(numReads, span, readLen)
      const data = makePileupData({ regionStart: 0, reads })
      const cap = caps[trial % caps.length]!
      const got = computeLayout(data, false, cap)
      const ref = refFirstFit(data, cap)
      expect(got.maxY).toBe(ref.maxY)
      expect(got.truncated).toBe(ref.truncated)
      expect(Array.from(got.readYs)).toEqual(Array.from(ref.ys))
    }
  })
})

describe('computeSortedLayout', () => {
  test('overlapping reads get distinct rows in base-sort order', () => {
    // All three reads straddle pos 500. Base codes: A=65, C=67, G=71.
    // Sorted-by-base ascending → row order A (read 2), C (read 0), G (read 1).
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 700, baseAtSortPos: 'C' },
        { start: 300, end: 800, baseAtSortPos: 'G' },
        { start: 450, end: 600, baseAtSortPos: 'A' },
      ],
    })
    const { readYs, maxY } = computeSortedLayout(data, makeSortedBy(500))
    // Each overlapping read gets its own row
    expect(maxY).toBe(3)
    expect(readYs[2]).toBe(0) // A first
    expect(readYs[0]).toBe(1) // C second
    expect(readYs[1]).toBe(2) // G third
    assertNonOverlappingLayout(data, readYs)
  })

  test('non-overlapping read fits into gap of overlap row (gap-filling)', () => {
    // Overlap reads at sortPos=500 both have extents that leave a gap
    // before them. A non-overlap read with small start must find that gap.
    // The old levels-array approach would overwrite the row's right edge
    // and force this read onto a new row.
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 700, baseAtSortPos: 'A' }, // overlap → row 0
        { start: 450, end: 800, baseAtSortPos: 'C' }, // overlap → row 1
        { start: 10, end: 100 }, // non-overlap before everything
      ],
    })
    const { readYs } = computeSortedLayout(data, makeSortedBy(500))
    // Non-overlap should fit in row 0 (gap [0, 400) is free)
    expect(readYs[2]).toBe(0)
    assertNonOverlappingLayout(data, readYs)
  })

  test('no overlaps in any row when reads arrive out of start order', () => {
    // Mix of overlap + non-overlap reads at varying starts. This is the
    // user-reported scenario: sort-by-base reorders processing, and the
    // end-array layout produces visually wrong results.
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 300, end: 600, baseAtSortPos: 'T' },
        { start: 400, end: 700, baseAtSortPos: 'A' },
        { start: 450, end: 800, baseAtSortPos: 'C' },
        { start: 50, end: 150 },
        { start: 200, end: 280 },
        { start: 750, end: 900 },
        { start: 820, end: 900 },
        { start: 10, end: 45 },
        { start: 160, end: 195 },
      ],
    })
    const { readYs } = computeSortedLayout(data, makeSortedBy(500))
    assertNonOverlappingLayout(data, readYs)
  })

  test('overlapping reads without baseAtSortPos sort after those with one', () => {
    // Reads with no mismatch at sortPos are placed AFTER reads with one
    // (sortOverlappingByIndex puts baseAtPos=0 last).
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 600 }, // no base → last
        { start: 420, end: 620, baseAtSortPos: 'C' },
      ],
    })
    const { readYs } = computeSortedLayout(data, makeSortedBy(500))
    expect(readYs[1]).toBe(0)
    expect(readYs[0]).toBe(1)
  })

  test('position sort: overlapping reads placed in start order', () => {
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 450, end: 600 },
        { start: 400, end: 650 },
        { start: 480, end: 700 },
      ],
    })
    const { readYs } = computeSortedLayout(data, makeSortedBy(500, 'position'))
    // sort by position ascending → read 1 (400), read 0 (450), read 2 (480)
    expect(readYs[1]).toBe(0)
    expect(readYs[0]).toBe(1)
    expect(readYs[2]).toBe(2)
  })

  test('no gaps at row ends: strictly stacked overlap rows', () => {
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 700, baseAtSortPos: 'C' },
        { start: 300, end: 800, baseAtSortPos: 'G' },
        { start: 450, end: 600, baseAtSortPos: 'A' },
      ],
    })
    const { readYs, maxY } = computeSortedLayout(data, makeSortedBy(500))
    // Row indices 0,1,2 all used
    const rows = new Set([readYs[0], readYs[1], readYs[2]])
    expect(rows.size).toBe(3)
    expect(maxY).toBe(3)
  })

  // HP-tag phased-read sort: overlapping reads at sortPos are grouped by
  // haplotype (HP=1 above HP=0) before non-overlap reads fill rows. Numeric
  // tag values sort descending (Number(b) - Number(a)).
  test('tag sort (HP): HP=1 reads placed above HP=0 reads', () => {
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 700, tagValue: '0' },
        { start: 420, end: 720, tagValue: '1' },
        { start: 440, end: 740, tagValue: '0' },
        { start: 460, end: 760, tagValue: '1' },
      ],
    })
    const { readYs, maxY } = computeSortedLayout(
      data,
      makeSortedBy(500, 'tag', 'HP'),
    )
    expect(maxY).toBe(4)
    const hp1Rows = [readYs[1]!, readYs[3]!].sort()
    const hp0Rows = [readYs[0]!, readYs[2]!].sort()
    expect(hp1Rows).toEqual([0, 1])
    expect(hp0Rows).toEqual([2, 3])
    assertNonOverlappingLayout(data, readYs)
  })

  test('tag sort (HP): reads without HP tag sort after tagged reads', () => {
    // Missing tag coerces to Number('') = 0 in the numeric branch, so it
    // ties with HP=0 rather than going last. This codifies current
    // behavior — change this test if the tie-break rule changes.
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 700, tagValue: '1' },
        { start: 420, end: 720 },
        { start: 440, end: 740, tagValue: '0' },
      ],
    })
    const { readYs } = computeSortedLayout(data, makeSortedBy(500, 'tag', 'HP'))
    expect(readYs[0]).toBe(0)
    assertNonOverlappingLayout(data, readYs)
  })

  test('tag sort (HP): non-overlapping read gap-fills around tag-sorted block', () => {
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 700, tagValue: '1' }, // overlap HP=1
        { start: 420, end: 720, tagValue: '0' }, // overlap HP=0
        { start: 10, end: 100 }, // non-overlap before
        { start: 800, end: 900 }, // non-overlap after
      ],
    })
    const { readYs, maxY } = computeSortedLayout(
      data,
      makeSortedBy(500, 'tag', 'HP'),
    )
    expect(readYs[0]).toBe(0)
    expect(readYs[1]).toBe(1)
    expect(maxY).toBe(2)
    assertNonOverlappingLayout(data, readYs)
  })

  test('tag sort with string values uses lexicographic descending order', () => {
    // For string tag values (e.g. RG=sampleA/sampleB), the comparator
    // falls back to localeCompare descending.
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 700, tagValue: 'sampleA' },
        { start: 420, end: 720, tagValue: 'sampleB' },
      ],
    })
    const { readYs } = computeSortedLayout(data, makeSortedBy(500, 'tag', 'RG'))
    // 'sampleB' > 'sampleA' → sampleB gets row 0
    expect(readYs[1]).toBe(0)
    expect(readYs[0]).toBe(1)
  })

  test('tag sort with a numeric-looking first value but string rest stays lexicographic', () => {
    // A leading value that parses as a number must not switch the whole column
    // to numeric mode — the string tags would coerce to NaN and garble the
    // order. Mode is decided by scanning every value, not just the first.
    const data = makePileupData({
      regionStart: 0,
      sortPos: 500,
      reads: [
        { start: 400, end: 700, tagValue: '10' },
        { start: 420, end: 720, tagValue: 'barcodeB' },
        { start: 440, end: 740, tagValue: 'barcodeA' },
      ],
    })
    const { readYs } = computeSortedLayout(data, makeSortedBy(500, 'tag', 'BX'))
    // localeCompare descending: 'barcodeB' > 'barcodeA' > '10'
    expect(readYs[1]).toBe(0)
    expect(readYs[2]).toBe(1)
    expect(readYs[0]).toBe(2)
  })
})

describe('placeRect scale', () => {
  test('wide row: 2000 sequential reads all pack into row 0', () => {
    // Validates the binary-search path and the O(1) append fast-path.
    const reads: Read[] = []
    for (let i = 0; i < 2000; i++) {
      reads.push({ start: i * 200, end: i * 200 + 150 })
    }
    const data = makePileupData({ regionStart: 0, reads })
    const { readYs, maxY } = computeLayout(data)
    expect(maxY).toBe(1)
    for (let i = 0; i < 2000; i++) {
      expect(readYs[i]).toBe(0)
    }
    assertNonOverlappingLayout(data, readYs)
  })

  test('wide row gap-fill: many start-sorted reads, then inserts land in middle-row gaps', () => {
    // Lay down 1000 reads at even positions (row 0 full of gaps at odd
    // positions), then insert 500 reads that must splice into gaps.
    // Exercises the binary-search insertion-point lookup.
    const reads: Read[] = []
    for (let i = 0; i < 1000; i++) {
      reads.push({ start: i * 100, end: i * 100 + 40 })
    }
    // Out-of-order gap-fillers that each fit in an even-position gap
    for (let i = 0; i < 500; i++) {
      const slot = 1000 - i - 1 // iterate from the end to force mid-row splice
      reads.push({ start: slot * 100 + 50, end: slot * 100 + 80 })
    }
    const data = makePileupData({ regionStart: 0, reads })
    const { readYs, maxY } = computeLayout(data)
    // All reads fit in one row (each pair of [0..40] and [50..80] in
    // the same 100bp slot is non-overlapping)
    expect(maxY).toBe(1)
    assertNonOverlappingLayout(data, readYs)
  })

  test('wide row collision: mid-row insertion collides, falls through to new row', () => {
    // Row 0 has 500 intervals. A new read's range overlaps one of the
    // middle ones. Binary search must find the correct collision
    // candidate, not just the first one.
    const reads: Read[] = []
    for (let i = 0; i < 500; i++) {
      reads.push({ start: i * 100, end: i * 100 + 80 })
    }
    // Overlaps read #250: read#250 is at [25000, 25080], collider is [25050, 25150]
    reads.push({ start: 25050, end: 25150 })
    const data = makePileupData({ regionStart: 0, reads })
    const { readYs, maxY } = computeLayout(data)
    expect(maxY).toBe(2)
    expect(readYs[500]).toBe(1)
    assertNonOverlappingLayout(data, readYs)
  })
})

describe('computeMultiRegionLayout', () => {
  test('dedupes reads by featureId across regions', () => {
    const r1 = makePileupData({
      regionStart: 0,
      reads: [{ start: 100, end: 200 }],
    })
    const r2 = makePileupData({
      regionStart: 300,
      reads: [{ start: 350, end: 400 }],
    })
    const { rowMap, maxY } = computeMultiRegionLayout({
      entries: [
        [0, r1],
        [1, r2],
      ],
    })
    // Both reads have the same featureId 'id0' so the second collapses
    expect(rowMap.size).toBe(1)
    expect(maxY).toBe(1)
  })

  const chr1 = (start: number, end: number) => ({
    refName: 'chr1',
    start,
    end,
  })

  test('sorts reads at the sort position when all regions share a refName', () => {
    // exon-1 region has an unrelated read; exon-2 region has three reads
    // overlapping the sort position with bases T/A/C (collapse-introns case).
    const exon1 = makePileupData({
      regionStart: 0,
      reads: [{ start: 10, end: 50 }],
    })
    const exon2 = makePileupData({
      regionStart: 200,
      sortPos: 250,
      idPrefix: 'b',
      reads: [
        { start: 240, end: 260, baseAtSortPos: 'T' },
        { start: 245, end: 265, baseAtSortPos: 'A' },
        { start: 248, end: 268, baseAtSortPos: 'C' },
      ],
    })
    const { rowMap } = computeMultiRegionLayout({
      entries: [
        [0, exon1],
        [1, exon2],
      ],
      regions: new Map([
        [0, chr1(0, 100)],
        [1, chr1(200, 300)],
      ]),
      sortedBy: {
        type: 'basePair',
        pos: 250,
        refName: 'chr1',
        assemblyName: 'a',
      },
    })
    // ascending base order A < C < T, each on its own row (all collide at 250)
    expect(rowMap.get('b1')).toBeLessThan(rowMap.get('b2')!)
    expect(rowMap.get('b2')).toBeLessThan(rowMap.get('b0')!)
  })

  test('largeFeaturesFirst orders by unioned extent across regions', () => {
    // A wide boundary-spanning read (id0, present in both regions) plus a small
    // read in region 0 that starts earlier. Largest-first must place the wide
    // read's row below the small one despite the small one's earlier start.
    const r1 = makePileupData({
      regionStart: 0,
      reads: [
        { start: 0, end: 100 }, // id0 wide, spans into r2
        { start: 5, end: 15 }, // id1 small, overlaps id0
      ],
    })
    const r2 = makePileupData({
      regionStart: 100,
      reads: [{ start: 100, end: 200 }], // id0 again (same featureId)
    })
    const { rowMap } = computeMultiRegionLayout({
      entries: [
        [0, r1],
        [1, r2],
      ],
      largeFeaturesFirst: true,
    })
    expect(rowMap.get('id0')).toBe(0)
    expect(rowMap.get('id1')).toBe(1)
  })

  test('an active position sort wins over largeFeaturesFirst', () => {
    // Both flags set: the basePair sort at 250 orders the overlapping reads,
    // largeFeaturesFirst is ignored (see buildLaidOutPileupMap precedence).
    const exon = makePileupData({
      regionStart: 200,
      sortPos: 250,
      reads: [
        { start: 240, end: 400, baseAtSortPos: 'T' }, // widest, but sorts last
        { start: 245, end: 265, baseAtSortPos: 'A' },
        { start: 248, end: 268, baseAtSortPos: 'C' },
      ],
    })
    const { rowMap } = computeMultiRegionLayout({
      entries: [[0, exon]],
      regions: new Map([[0, chr1(200, 300)]]),
      sortedBy: {
        type: 'basePair',
        pos: 250,
        refName: 'chr1',
        assemblyName: 'a',
      },
      largeFeaturesFirst: true,
    })
    // ascending base order A < C < T — the wide 'T' read still sorts last,
    // proving the position sort took precedence over extent order.
    expect(rowMap.get('id1')).toBeLessThan(rowMap.get('id2')!)
    expect(rowMap.get('id2')).toBeLessThan(rowMap.get('id0')!)
  })

  test('expands read extents by soft clips across regions', () => {
    const exon1 = makePileupData({
      regionStart: 0,
      reads: [{ start: 10, end: 20 }],
    })
    // b1's left soft clip expands it to [220,290], overlapping b0 [235,245];
    // without expansion the two sit 35bp apart and share a row.
    const exon2 = () =>
      makePileupData({
        regionStart: 200,
        idPrefix: 'b',
        reads: [
          { start: 235, end: 245 },
          { start: 280, end: 290, softclip: { pos: 280, length: 60 } },
        ],
      })
    const regions = new Map([
      [0, chr1(0, 100)],
      [1, chr1(200, 300)],
    ])
    const off = computeMultiRegionLayout({
      entries: [
        [0, exon1],
        [1, exon2()],
      ],
      regions,
    })
    const on = computeMultiRegionLayout({
      entries: [
        [0, exon1],
        [1, exon2()],
      ],
      regions,
      showSoftClipping: true,
    })
    expect(off.rowMap.get('b0')).toBe(off.rowMap.get('b1'))
    expect(on.rowMap.get('b0')).not.toBe(on.rowMap.get('b1'))
  })

  test('does not sort when regions span different refNames', () => {
    const args = (sortedBy?: SortedBy) =>
      computeMultiRegionLayout({
        entries: [
          [
            0,
            makePileupData({
              regionStart: 0,
              sortPos: 50,
              reads: [
                { start: 40, end: 60, baseAtSortPos: 'T' },
                { start: 45, end: 65, baseAtSortPos: 'A' },
              ],
            }),
          ],
          [
            1,
            makePileupData({
              regionStart: 200,
              idPrefix: 'b',
              reads: [{ start: 240, end: 260 }],
            }),
          ],
        ],
        regions: new Map([
          [0, { refName: 'chr1', start: 0, end: 100 }],
          [1, { refName: 'chr2', start: 200, end: 300 }],
        ]),
        sortedBy,
      })
    // mixed refNames → sort is skipped, so layout matches the unsorted result
    const sorted = args({
      type: 'basePair',
      pos: 50,
      refName: 'chr1',
      assemblyName: 'a',
    })
    const unsorted = args(undefined)
    expect([...sorted.rowMap]).toEqual([...unsorted.rowMap])
  })

  test('reads on different refNames do not collide on the placement axis', () => {
    // ctgA:1-1000 and ctgB:1-1000 share the genomic coordinate axis, so a naive
    // single-axis placement stacks ctgB's reads *below* ctgA's — each ctgB read
    // pushed down past every ctgA read covering the same bp, leaving the top
    // rows of ctgB empty (the read_cloud figure's whitespace).
    const ctgAReads = makePileupData({
      regionStart: 0,
      idPrefix: 'a',
      reads: [
        { start: 100, end: 200 },
        { start: 110, end: 210 },
        { start: 120, end: 220 },
      ],
    })
    const ctgBReads = makePileupData({
      regionStart: 0,
      idPrefix: 'b',
      reads: [{ start: 100, end: 200 }],
    })
    const { rowMap, maxY } = computeMultiRegionLayout({
      entries: [
        [0, ctgAReads],
        [1, ctgBReads],
      ],
      regions: new Map([
        [0, { refName: 'ctgA', start: 0, end: 1000 }],
        [1, { refName: 'ctgB', start: 0, end: 1000 }],
      ]),
    })
    // ctgA's three mutually-overlapping reads need rows 0,1,2. ctgB's lone read
    // shares no screen space with any of them, so it belongs on row 0.
    expect(rowMap.get('a0')).toBe(0)
    expect(rowMap.get('a1')).toBe(1)
    expect(rowMap.get('a2')).toBe(2)
    expect(rowMap.get('b0')).toBe(0)
    expect(maxY).toBe(3)
  })
})

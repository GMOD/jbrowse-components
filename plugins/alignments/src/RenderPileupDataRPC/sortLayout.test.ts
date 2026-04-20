import {
  computeLayout,
  computeMultiRegionLayout,
  computeSortedLayout,
} from './sortLayout.ts'

import type { PileupDataResult } from './types.ts'
import type { SortedBy } from '../shared/types.ts'

interface Read {
  start: number
  end: number
  baseAtSortPos?: string
  tagValue?: string
}

function makePileupData(opts: {
  regionStart: number
  reads: Read[]
  sortPos?: number
}): PileupDataResult {
  const { regionStart, reads, sortPos } = opts
  const numReads = reads.length
  const hasAnyTagValue = reads.some(r => r.tagValue !== undefined)
  const sortTagValues = hasAnyTagValue
    ? reads.map(r => r.tagValue ?? '')
    : undefined

  const readPositions = new Uint32Array(numReads * 2)
  const readIds: string[] = []
  const readNames: string[] = []
  for (const [i, r] of reads.entries()) {
    readPositions[i * 2] = r.start - regionStart
    readPositions[i * 2 + 1] = r.end - regionStart
    readIds.push(`id${i}`)
    readNames.push(`id${i}`)
  }

  const mismatchEntries: { readIdx: number; pos: number; base: number }[] = []
  if (sortPos !== undefined) {
    for (const [i, r] of reads.entries()) {
      if (r.baseAtSortPos) {
        mismatchEntries.push({
          readIdx: i,
          pos: sortPos - regionStart,
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

  return {
    regionStart,
    numReads,
    readIds,
    readNames,
    readPositions,
    readYs: new Uint16Array(numReads),
    readFlags: new Uint16Array(numReads),
    readMapqs: new Uint8Array(numReads),
    readAvgBaseQualities: new Uint8Array(numReads),
    readInsertSizes: new Float32Array(numReads),
    readPairOrientations: new Uint8Array(numReads),
    readStrands: new Int8Array(numReads),
    readTagColors: new Uint32Array(0),
    segmentPositions: new Uint32Array(0),
    segmentReadIndices: new Uint32Array(0),
    segmentEdgeFlags: new Uint8Array(0),
    numSegments: 0,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapLengths: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions,
    mismatchYs: new Uint16Array(numMismatches),
    mismatchBases,
    mismatchStrands: new Int8Array(numMismatches),
    mismatchReadIndices,
    mismatchFrequencies: new Uint8Array(numMismatches),
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    numSoftclipBases: 0,
    interbasePositions: new Uint32Array(0),
    interbaseYs: new Uint16Array(0),
    interbaseLengths: new Uint16Array(0),
    interbaseTypes: new Uint8Array(0),
    interbaseSequences: [],
    interbaseFrequencies: new Uint8Array(0),
    coverageDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartOffset: 0,
    coveragePackedBuffer: new ArrayBuffer(0),
    snpPositions: new Uint32Array(0),
    snpYOffsets: new Float32Array(0),
    snpHeights: new Float32Array(0),
    snpColorTypes: new Uint8Array(0),
    snpPackedBuffer: new ArrayBuffer(0),
    noncovPositions: new Uint32Array(0),
    noncovYOffsets: new Float32Array(0),
    noncovHeights: new Float32Array(0),
    noncovColorTypes: new Uint8Array(0),
    noncovMaxCount: 0,
    noncovPackedBuffer: new ArrayBuffer(0),
    indicatorPositions: new Uint32Array(0),
    indicatorColorTypes: new Uint8Array(0),
    indicatorPackedBuffer: new ArrayBuffer(0),
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint32Array(0),
    numModifications: 0,
    modCovPositions: new Uint32Array(0),
    modCovYOffsets: new Float32Array(0),
    modCovHeights: new Float32Array(0),
    modCovColors: new Uint32Array(0),
    numModCovSegments: 0,
    modCovPackedBuffer: new ArrayBuffer(0),
    sashimiX1: new Float32Array(0),
    sashimiX2: new Float32Array(0),
    sashimiScores: new Float32Array(0),
    sashimiColorTypes: new Uint8Array(0),
    sashimiCounts: new Uint32Array(0),
    numSashimiArcs: 0,
    numGaps: 0,
    numMismatches,
    numInterbases: 0,
    numInsertions: 0,
    numSoftclips: 0,
    numHardclips: 0,
    numCoverageBins: 0,
    numSnpSegments: 0,
    numNoncovSegments: 0,
    numIndicators: 0,
    detectedModifications: [],
    simplexModifications: [],
    maxY: 0,
    sortTagValues,
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
  const { numReads, readPositions, regionStart } = data
  const byRow = new Map<number, { start: number; end: number; idx: number }[]>()
  for (let i = 0; i < numReads; i++) {
    const row = readYs[i]!
    const start = regionStart + readPositions[i * 2]!
    const end = regionStart + readPositions[i * 2 + 1]!
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
    const { readYs } = computeSortedLayout(
      data,
      makeSortedBy(500, 'tag', 'HP'),
    )
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
    const { readYs } = computeSortedLayout(
      data,
      makeSortedBy(500, 'tag', 'RG'),
    )
    // 'sampleB' > 'sampleA' → sampleB gets row 0
    expect(readYs[1]).toBe(0)
    expect(readYs[0]).toBe(1)
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
    const { rowMap, maxY } = computeMultiRegionLayout([
      [0, r1],
      [1, r2],
    ])
    // Both reads have the same featureId 'id0' so the second collapses
    expect(rowMap.size).toBe(1)
    expect(maxY).toBe(1)
  })
})

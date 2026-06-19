import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
  arcsToRegionResult,
  computeArcsFromPileupData,
  groupArcsByRef,
} from './compute.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

function makePileupData(
  overrides: Partial<PileupDataResult> & {
    regionStart: number
  },
): PileupDataResult {
  const n = (overrides.readPositions?.length ?? 0) / 2
  return {
    readPositions: new Uint32Array(n * 2),
    readYs: new Uint16Array(n),
    readFlags: new Uint16Array(n),
    readMapqs: new Uint8Array(n),
    readInsertSizes: new Float32Array(n),
    readPairOrientations: new Uint8Array(n),
    readStrands: new Int8Array(n),
    readInterchrom: new Uint8Array(n),
    readIds: Array.from({ length: n }, (_, i) => `id${i}`),
    readNames: Array.from({ length: n }, (_, i) => `read${i}`),
    readTagColors: new Uint32Array(0),
    segmentPositions: new Uint32Array(n * 2),
    segmentReadIndices: new Uint32Array(n),
    segmentEdgeFlags: new Uint8Array(n),
    numSegments: n,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapLengths: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapReadIndices: new Uint32Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions: new Uint32Array(0),
    mismatchYs: new Uint16Array(0),
    mismatchBases: new Uint8Array(0),
    mismatchStrands: new Int8Array(0),
    mismatchReadIndices: new Uint32Array(0),
    mismatchFrequencies: new Uint8Array(0),
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    softclipBaseReadIndices: new Uint32Array(0),
    interbasePositions: new Uint32Array(0),
    interbaseYs: new Uint16Array(0),
    interbaseLengths: new Uint16Array(0),
    interbaseTypes: new Uint8Array(0),
    interbaseReadIndices: new Uint32Array(0),
    interbaseSequences: [],
    interbaseFrequencies: new Uint8Array(0),
    coverageDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartPos: 0,
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
    sashimiScores: new Float32Array(0),
    sashimiColorTypes: new Uint8Array(0),
    sashimiCounts: new Uint32Array(0),
    maxY: 0,
    numInsertions: 0,
    numSoftclips: 0,
    numHardclips: 0,
    detectedModifications: [],
    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
    overlapPositions: new Uint32Array(0),
    overlapYs: new Uint16Array(0),
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
    ...overrides,
  }
}

describe('computeArcsFromPileupData', () => {
  test('returns empty result for empty data', () => {
    const result = computeArcsFromPileupData(new Map(), [], {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })
    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('paired-end same-chromosome produces arc', () => {
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
      readNextRefs: ['chr1'],
      readNextPositions: new Uint32Array([2000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.p1.refName).toBe('chr1')
    expect(result.arcs[0]!.p2.refName).toBe('chr1')
    expect(result.arcs[0]!.p1.bp).toBe(1100)
    expect(result.arcs[0]!.p2.bp).toBe(2000)
  })

  test('inter-chromosomal paired-end produces vertical lines when drawInter=true', () => {
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      readNames: ['readA'],
      readNextRefs: ['chr2'],
      readNextPositions: new Uint32Array([5000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines.length).toBe(2)
    expect(result.lines[0]!.x.refName).toBe('chr1')
    expect(result.lines[1]!.x.refName).toBe('chr2')
    // Interchromosomal pairs color with the dedicated interchromosomal slot (3)
    // under the insert-size schemes (the refs differ).
    expect(result.lines[0]!.colorType).toBe(3)
    expect(result.lines[1]!.colorType).toBe(3)
  })

  test('inter-chromosomal always uses the interchrom color regardless of orientation', () => {
    // RL orientation (2) would resolve to the RL slot (6) for a same-chromosome
    // arc; across chromosomes "pair orientation" is meaningless, so the tick
    // must stay the single interchrom color (3) and not vary by orientation.
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([2]),
      readNames: ['readA'],
      readNextRefs: ['chr2'],
      readNextPositions: new Uint32Array([5000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })

    expect(result.lines.length).toBe(2)
    expect(result.lines[0]!.colorType).toBe(3)
    expect(result.lines[1]!.colorType).toBe(3)
  })

  test('inter-chromosomal produces nothing when drawInter=false', () => {
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      readNames: ['readA'],
      readNextRefs: ['chr2'],
      readNextPositions: new Uint32Array([5000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('single-region reads with drawLongRange=false are skipped', () => {
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
      readNextRefs: ['chr1'],
      readNextPositions: new Uint32Array([2000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: false,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('mate-unmapped reads are skipped for paired-end arcs', () => {
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_MATE_UNMAPPED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      readNames: ['readA'],
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('supplementary alignment SA tag produces arcs for long reads', () => {
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      readNames: ['readA'],
      readSuppAlignments: ['chr1,3001,+,200M,60,0;'],
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.p1.bp).toBe(1500)
    expect(result.arcs[0]!.p2.bp).toBe(3000)
  })

  test('malformed SA tag entries are skipped, not emitted as NaN arcs', () => {
    // Three semicolon-separated entries: one truncated (3 fields), one with a
    // placeholder CIGAR, one with a non-numeric position. None should produce
    // an arc; the unrelated trailing valid entry should be the only one drawn.
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      readNames: ['readA'],
      readSuppAlignments: [
        'chr1,3001,+;chr1,4001,+,*,60,0;chr1,abc,+,200M,60,0;chr1,5001,+,200M,60,0;',
      ],
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    // One arc per consecutive SA-chain pair; the three malformed entries are
    // skipped, leaving only primary→(chr1:5001..5201) → 1 arc.
    expect(result.arcs).toHaveLength(1)
    expect(result.arcs[0]!.p1.bp).toBe(1500)
    expect(result.arcs[0]!.p2.bp).toBe(5000)
    expect(Number.isNaN(result.arcs[0]!.p2.bp)).toBe(false)
  })

  test('cross-region reads (same name in two regions) produce arcs', () => {
    const data0 = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
    })
    const data1 = makePileupData({
      regionStart: 5000,
      readPositions: new Uint32Array([5000, 5100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
    })

    const rpcDataMap = new Map([
      [0, data0],
      [1, data1],
    ])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
      { refName: 'chr1', start: 5000, end: 6000, displayedRegionIndex: 1 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: false,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.p1.bp).toBe(1100)
    expect(result.arcs[0]!.p2.bp).toBe(5100)
  })

  test('orientation coloring: RL gives colorType 6', () => {
    const data = makePileupData({
      regionStart: 0,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([2]),
      readNames: ['readA'],
      readNextRefs: ['chr1'],
      readNextPositions: new Uint32Array([500]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'orientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.colorType).toBe(6)
  })

  test('insert size coloring uses worker-provided insertSizeStats', () => {
    const data = makePileupData({
      regionStart: 0,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([10000]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
      readNextRefs: ['chr1'],
      readNextPositions: new Uint32Array([500]),
      insertSizeStats: { upper: 500, lower: 100 },
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSize',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    // tlen=10000 > upper=500 → colorType 1 (too long)
    expect(result.arcs[0]!.colorType).toBe(1)
  })

  test('very-long-range pairs are plain arcs (no bp-based line conversion)', () => {
    const data = makePileupData({
      regionStart: 0,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500000]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
      readNextRefs: ['chr1'],
      readNextPositions: new Uint32Array([500000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 0, end: 600000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    // No bp threshold reshapes far pairs: still a single arc (the renderer draws
    // it as near-vertical lines at this zoom), colored as a long insert.
    expect(result.lines).toEqual([])
    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.shapeType).toBe(ARC_SHAPE_ARC)
    expect(result.arcs[0]!.colorType).toBe(1)
  })

  test('read cloud colors by orientation like arcs (insertSizeAndOrientation)', () => {
    const mkData = (orient: number) =>
      makePileupData({
        regionStart: 0,
        readPositions: new Uint32Array([0, 100]),
        readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
        readStrands: new Int8Array([1]),
        readInsertSizes: new Float32Array([500]),
        readPairOrientations: new Uint8Array([orient]),
        readNames: ['readA'],
        readNextRefs: ['chr1'],
        readNextPositions: new Uint32Array([500]),
      })
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const opts = {
      colorByType: 'insertSizeAndOrientation' as const,
      samplot: true,
      drawInter: false,
      drawLongRange: true,
    }
    const run = (orient: number) =>
      computeArcsFromPileupData(new Map([[0, mkData(orient)]]), regions, opts)

    // LR/normal (no stats) → default arc slot 0
    const lr = run(1)
    expect(lr.arcs).toHaveLength(1)
    expect(lr.arcs[0]!.colorType).toBe(0)
    // Flat shape + Y ≈ |tlen| (samplot applies ±8% jitter)
    expect(lr.arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT)
    expect(lr.arcs[0]!.yBp).toBeGreaterThanOrEqual(460)
    expect(lr.arcs[0]!.yBp).toBeLessThanOrEqual(540)

    // Aberrant orientations map to the arc palette: RL→6 (teal), RR→5 (navy),
    // FF→4 (green) — same getOrientationColorIndex as arc mode.
    expect(run(2).arcs[0]!.colorType).toBe(6)
    expect(run(3).arcs[0]!.colorType).toBe(5)
    expect(run(4).arcs[0]!.colorType).toBe(4)
  })

  test('read cloud colors long inserts red like arcs (slot 1)', () => {
    const data = makePileupData({
      regionStart: 0,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([10000]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
      readNextRefs: ['chr1'],
      readNextPositions: new Uint32Array([500]),
      insertSizeStats: { upper: 500, lower: 100 },
    })
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation' as const,
      samplot: true,
      drawInter: false,
      drawLongRange: true,
    })
    // tlen 10000 > upper 500 → long-insert slot 1 (red), not a samplot DUP color
    expect(result.arcs).toHaveLength(1)
    expect(result.arcs[0]!.colorType).toBe(1)
  })

  test('samplot drops concordant FR pairs within insert-size stats band', () => {
    const mkPair = (tlen: number) =>
      makePileupData({
        regionStart: 0,
        readPositions: new Uint32Array([0, 100]),
        readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
        readStrands: new Int8Array([1]),
        readInsertSizes: new Float32Array([tlen]),
        readPairOrientations: new Uint8Array([1]),
        readNames: ['readA'],
        readNextRefs: ['chr1'],
        readNextPositions: new Uint32Array([500]),
        insertSizeStats: { upper: 500, lower: 100 },
      })
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const opts = {
      colorByType: 'insertSizeAndOrientation' as const,
      samplot: true,
      drawInter: false,
      drawLongRange: true,
    }
    // tlen=300 ∈ [100, 500] FR → dropped
    expect(
      computeArcsFromPileupData(new Map([[0, mkPair(300)]]), regions, opts)
        .arcs,
    ).toHaveLength(0)
    // tlen=10000 > upper → kept (discordant long-insert)
    expect(
      computeArcsFromPileupData(new Map([[0, mkPair(10000)]]), regions, opts)
        .arcs,
    ).toHaveLength(1)
  })

  test('read cloud SA-tag arcs color by strand like arcs (FR→4, same-strand→0)', () => {
    const mkSplit = (primaryStrand: number, saStrand: '+' | '-') =>
      makePileupData({
        regionStart: 1000,
        readPositions: new Uint32Array([1000, 1500]),
        readFlags: new Uint16Array([0]),
        readStrands: new Int8Array([primaryStrand]),
        readInsertSizes: new Float32Array([0]),
        readPairOrientations: new Uint8Array([0]),
        readNames: ['readA'],
        readSuppAlignments: [`chr1,3001,${saStrand},200M,60,0;`],
      })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const opts = {
      colorByType: 'insertSizeAndOrientation' as const,
      samplot: true,
      drawInter: false,
      drawLongRange: true,
    }
    // Same strand (+/+) → default unpaired orientation slot 0
    expect(
      computeArcsFromPileupData(new Map([[0, mkSplit(1, '+')]]), regions, opts)
        .arcs[0]!.colorType,
    ).toBe(0)
    // Opposite strand (+/-) → unpaired FR slot 4 (fwd→rev breakpoint)
    expect(
      computeArcsFromPileupData(new Map([[0, mkSplit(1, '-')]]), regions, opts)
        .arcs[0]!.colorType,
    ).toBe(4)
  })

  test('samplot in-view split read (primary + supplementary entries) is dashed at the gap span', () => {
    // The default flag filter does not exclude SUPPLEMENTARY (2048), so an
    // in-view split read arrives as two entries sharing a name — the
    // multi-entry path, not the single-entry SA-tag path. It must render
    // identically: dashed, at the gap span, never collapsed to the baseline
    // by the supplementary's tlen=0.
    const mkInViewSplit = (s1: number, s2: number) =>
      makePileupData({
        regionStart: 1000,
        readPositions: new Uint32Array([1000, 1500, 3001, 3201]),
        readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
        readStrands: new Int8Array([s1, s2]),
        readInsertSizes: new Float32Array([0, 0]),
        readPairOrientations: new Uint8Array([0, 0]),
        readNames: ['readA', 'readA'],
      })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const opts = {
      colorByType: 'insertSizeAndOrientation' as const,
      samplot: true,
      drawInter: false,
      drawLongRange: true,
    }

    const inv = computeArcsFromPileupData(
      new Map([[0, mkInViewSplit(1, -1)]]),
      regions,
      opts,
    ).arcs
    expect(inv).toHaveLength(1)
    // dashed split shape, not solid ARC_SHAPE_FLAT
    expect(inv[0]!.shapeType).toBe(ARC_SHAPE_FLAT_SPLIT)
    // Y is the gap-span radius (|3001-1500|/2 ≈ 750), not collapsed to 0
    expect(inv[0]!.yBp).toBeGreaterThan(500)
    // opposite strands → unpaired FR slot 4 (arc coloring)
    expect(inv[0]!.colorType).toBe(4)

    // same strands → default slot 0, still dashed split
    const del = computeArcsFromPileupData(
      new Map([[0, mkInViewSplit(1, 1)]]),
      regions,
      opts,
    ).arcs
    expect(del[0]!.shapeType).toBe(ARC_SHAPE_FLAT_SPLIT)
    expect(del[0]!.colorType).toBe(0)
  })

  test('in-view split inversion connects a2↔b2, not a2↔b1', () => {
    // Primary fwd a=[1000,1500], supplementary rev b=[3001,3201]. The read
    // traverses a1→a2→b2→b1, so the junction joins a.end (a2=1500) to b.end
    // (b2=3201) — the breakpoint — not b.start (b1=3001), the far edge.
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1500, 3001, 3201]),
      readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
      readStrands: new Int8Array([1, -1]),
      readInsertSizes: new Float32Array([0, 0]),
      readPairOrientations: new Uint8Array([0, 0]),
      readNames: ['readA', 'readA'],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.p1.bp).toBe(1500) // a.end (a2)
    expect(arcs[0]!.p2.bp).toBe(3201) // b.end (b2), not 3001 (b1)
  })

  test('SA-tag split inversion connects a.end↔b.end (b rev)', () => {
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      readNames: ['readA'],
      readSuppAlignments: ['chr1,3001,-,200M,60,0;'],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.p1.bp).toBe(1500) // primary fwd: a.end
    expect(arcs[0]!.p2.bp).toBe(3200) // SA rev (pos 3001→start 3000, end 3200): b.end
  })

  test('3 split segments chain in read order (clip), not genomic order', () => {
    // Genomic order is seg0<seg1<seg2, but clip-at-start makes read order
    // seg1→seg2→seg0, so the two junctions are (seg1,seg2) and (seg2,seg0).
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([
        1000, 1200, 2000, 2200, 3000, 3200,
      ]),
      readFlags: new Uint16Array([
        SAM_FLAG_SUPPLEMENTARY,
        0,
        SAM_FLAG_SUPPLEMENTARY,
      ]),
      readStrands: new Int8Array([1, 1, 1]),
      readInsertSizes: new Float32Array([0, 0, 0]),
      readPairOrientations: new Uint8Array([0, 0, 0]),
      readNames: ['readA', 'readA', 'readA'],
      readClipAtStart: new Uint32Array([200, 0, 100]),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(2)
    // seg1.end (2200) → seg2.start (3000)
    expect([arcs[0]!.p1.bp, arcs[0]!.p2.bp]).toEqual([2200, 3000])
    // seg2.end (3200) → seg0.start (1000)
    expect([arcs[1]!.p1.bp, arcs[1]!.p2.bp]).toEqual([3200, 1000])
  })

  test('paired + SA-split: split junction colored by its own strands, not pair', () => {
    // read1 (first-in-pair) is SA-split fwd→rev — an inversion junction — and
    // read2 (second-in-pair) is its mate. The dataset is paired (global
    // hasPaired=true), but the split junction must still color by its segment
    // strands (FR slot 4), not fall into the paired insert-size branch.
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1200, 3000, 3200, 5000, 5200]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ]),
      readStrands: new Int8Array([1, -1, -1]),
      readInsertSizes: new Float32Array([600, 0, 600]),
      readPairOrientations: new Uint8Array([1, 0, 1]),
      readNames: ['readA', 'readA', 'readA'],
      readClipAtStart: new Uint32Array([0, 100, 0]),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(2)
    // arc[0] = read1's fwd→rev split junction (a.end 1200 → b.end 3200).
    expect([arcs[0]!.p1.bp, arcs[0]!.p2.bp]).toEqual([1200, 3200])
    // Colored FR (4) by its own strands — NOT the paired insert-size default
    // (0) the global hasPaired branch would have produced.
    expect(arcs[0]!.colorType).toBe(4)
    // arc[1] = the read1↔read2 mate link, still colored by pair semantics.
    expect([arcs[1]!.p1.bp, arcs[1]!.p2.bp]).toEqual([1200, 5000])
  })
})

describe('groupArcsByRef', () => {
  test('buckets arcs and lines by refName', () => {
    const arcs = [
      {
        p1: { refName: 'chr1', bp: 1100 },
        p2: { refName: 'chr1', bp: 1500 },
        colorType: 0,
        shapeType: 0,
        yBp: 200,
      },
      {
        p1: { refName: 'chr2', bp: 5000 },
        p2: { refName: 'chr2', bp: 6000 },
        colorType: 1,
        shapeType: 1,
        yBp: 500,
      },
    ]
    const lines = [
      { x: { refName: 'chr1', bp: 1200 }, colorType: 0 },
      { x: { refName: 'chr2', bp: 5500 }, colorType: 0 },
    ]
    const { arcsByRef, linesByRef } = groupArcsByRef(arcs, lines)
    expect(arcsByRef.get('chr1')?.length).toBe(1)
    expect(arcsByRef.get('chr2')?.length).toBe(1)
    expect(linesByRef.get('chr1')?.length).toBe(1)
    expect(linesByRef.get('chr2')?.length).toBe(1)
    expect(arcsByRef.get('chr3')).toBeUndefined()
  })
})

describe('arcsToRegionResult', () => {
  test('packs arcs and lines into typed arrays', () => {
    const regionArcs = [
      {
        p1: { refName: 'chr1', bp: 1100 },
        p2: { refName: 'chr1', bp: 1500 },
        colorType: 0,
        shapeType: 0,
        yBp: 200,
      },
    ]
    const regionLines = [{ x: { refName: 'chr1', bp: 1200 }, colorType: 0 }]

    const result = arcsToRegionResult(regionArcs, regionLines)

    expect(result.numArcs).toBe(1)
    expect(result.arcX1[0]).toBe(1100)
    expect(result.arcX2[0]).toBe(1500)
    expect(result.numArcLines).toBe(1)
    expect(result.arcLinePositions[0]).toBe(1200)
  })

  test('returns empty arrays for empty inputs', () => {
    const result = arcsToRegionResult([], [])

    expect(result.numArcs).toBe(0)
    expect(result.arcX1.length).toBe(0)
    expect(result.numArcLines).toBe(0)
  })

  test('one entry per connector line, packed in order', () => {
    const lines = [
      { x: { refName: 'chr1', bp: 1500 }, colorType: 3 },
      { x: { refName: 'chr1', bp: 2500 }, colorType: 3 },
    ]
    const result = arcsToRegionResult([], lines)

    expect(result.numArcLines).toBe(2)
    expect(Array.from(result.arcLinePositions)).toEqual([1500, 2500])
    expect(Array.from(result.arcLineColorTypes)).toEqual([3, 3])
  })
})

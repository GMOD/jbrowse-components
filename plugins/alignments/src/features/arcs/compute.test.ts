import { arcsToRegionResult, computeArcsFromPileupData } from './compute.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

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
    readAvgBaseQualities: new Uint8Array(n),
    readInsertSizes: new Float32Array(n),
    readPairOrientations: new Uint8Array(n),
    readStrands: new Int8Array(n),
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
    modificationReadIndices: new Uint32Array(0),
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
    simplexModifications: [],
    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
    ...overrides,
  }
}

const SAM_FLAG_PAIRED = 1
const SAM_FLAG_MATE_UNMAPPED = 8

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
    expect(result.lines[0]!.colorType).toBe(0)
    expect(result.lines[1]!.colorType).toBe(0)
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

  test('cross-region reads (same name in two regions) produce arcs', () => {
    const data0 = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
    })
    const data1 = makePileupData({
      regionStart: 5000,
      readPositions: new Uint32Array([5000, 5100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
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

  test('very long range arcs produce vertical lines when drawLongRange=true', () => {
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

    expect(result.arcs).toEqual([])
    expect(result.lines.length).toBe(2)
    expect(result.lines[0]!.colorType).toBe(1)
  })

  test('samplot coloring classifies by pair orientation', () => {
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
      colorByType: 'samplot' as const,
      drawInter: false,
      drawLongRange: true,
    }
    const run = (orient: number) =>
      computeArcsFromPileupData(new Map([[0, mkData(orient)]]), regions, opts)

    // LR/normal → DEL slot 0
    const del = run(1)
    expect(del.arcs).toHaveLength(1)
    expect(del.arcs[0]!.colorType).toBe(0)
    // Flat shape + Y ≈ |tlen| (samplot applies ±8% jitter)
    expect(del.arcs[0]!.shapeType).toBe(2)
    expect(del.arcs[0]!.yBp).toBeGreaterThanOrEqual(460)
    expect(del.arcs[0]!.yBp).toBeLessThanOrEqual(540)

    // RL/everted → DUP slot 1
    expect(run(2).arcs[0]!.colorType).toBe(1)
    // FF/RR same-strand → INV slot 2
    expect(run(3).arcs[0]!.colorType).toBe(2)
    expect(run(4).arcs[0]!.colorType).toBe(2)
  })

  test('samplot SA-tag arcs fall back to strand-pair classification', () => {
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
      colorByType: 'samplot' as const,
      drawInter: false,
      drawLongRange: true,
    }
    // Same strand (+/+) → INV
    expect(
      computeArcsFromPileupData(new Map([[0, mkSplit(1, '+')]]), regions, opts)
        .arcs[0]!.colorType,
    ).toBe(2)
    // Opposite strand (+/-) → DEL/normal fallback
    expect(
      computeArcsFromPileupData(new Map([[0, mkSplit(1, '-')]]), regions, opts)
        .arcs[0]!.colorType,
    ).toBe(0)
  })
})

describe('arcsToRegionResult', () => {
  test('filters arcs to only matching region', () => {
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

    const result = arcsToRegionResult(arcs, lines, 'chr1', 200)

    expect(result.numArcs).toBe(1)
    expect(result.arcX1[0]).toBe(1100)
    expect(result.arcX2[0]).toBe(1500)
    expect(result.numLines).toBe(1)
    expect(result.linePositions[0]).toBe(1200)
  })

  test('returns empty arrays when no arcs match region', () => {
    const arcs = [
      {
        p1: { refName: 'chr2', bp: 5000 },
        p2: { refName: 'chr2', bp: 6000 },
        colorType: 0,
        shapeType: 0,
        yBp: 500,
      },
    ]
    const result = arcsToRegionResult(arcs, [], 'chr1', 200)

    expect(result.numArcs).toBe(0)
    expect(result.arcX1.length).toBe(0)
    expect(result.numLines).toBe(0)
  })

  test('line Y values span 0 to height', () => {
    const lines = [{ x: { refName: 'chr1', bp: 1500 }, colorType: 0 }]
    const result = arcsToRegionResult([], lines, 'chr1', 300)

    expect(result.numLines).toBe(1)
    expect(result.lineYs[0]).toBe(0)
    expect(result.lineYs[1]).toBe(300)
  })
})

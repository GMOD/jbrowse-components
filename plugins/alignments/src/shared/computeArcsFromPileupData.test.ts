import {
  arcsToRegionResult,
  computeArcsFromPileupData,
} from './computeArcsFromPileupData.ts'

import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'

function makePileupData(
  overrides: Partial<PileupDataResult> & {
    numReads: number
    regionStart: number
  },
): PileupDataResult {
  const n = overrides.numReads
  return {
    readPositions: new Uint32Array(n * 2),
    readYs: new Uint16Array(n),
    readFlags: new Uint16Array(n),
    readMapqs: new Uint8Array(n),
    readInsertSizes: new Float32Array(n),
    readPairOrientations: new Uint8Array(n),
    readStrands: new Int8Array(n),
    readIds: Array.from({ length: n }, (_, i) => `id${i}`),
    readNames: Array.from({ length: n }, (_, i) => `read${i}`),
    readTagColors: new Uint8Array(0),
    numTagColors: 0,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapLengths: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions: new Uint32Array(0),
    mismatchYs: new Uint16Array(0),
    mismatchBases: new Uint8Array(0),
    mismatchStrands: new Int8Array(0),
    mismatchFrequencies: new Uint8Array(0),
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
    snpPositions: new Uint32Array(0),
    snpYOffsets: new Float32Array(0),
    snpHeights: new Float32Array(0),
    snpColorTypes: new Uint8Array(0),
    noncovPositions: new Uint32Array(0),
    noncovYOffsets: new Float32Array(0),
    noncovHeights: new Float32Array(0),
    noncovColorTypes: new Uint8Array(0),
    noncovMaxCount: 0,
    indicatorPositions: new Uint32Array(0),
    indicatorColorTypes: new Uint8Array(0),
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint8Array(0),
    numModifications: 0,
    modCovPositions: new Uint32Array(0),
    modCovYOffsets: new Float32Array(0),
    modCovHeights: new Float32Array(0),
    modCovColors: new Uint8Array(0),
    numModCovSegments: 0,
    sashimiX1: new Float32Array(0),
    sashimiX2: new Float32Array(0),
    sashimiScores: new Float32Array(0),
    sashimiColorTypes: new Uint8Array(0),
    sashimiCounts: new Uint32Array(0),
    numSashimiArcs: 0,
    maxY: 0,
    numGaps: 0,
    numMismatches: 0,
    numInterbases: 0,
    numCoverageBins: 0,
    numSnpSegments: 0,
    numNoncovSegments: 0,
    numIndicators: 0,
    detectedModifications: [],
    simplexModifications: [],
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
      numReads: 1,
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
      { refName: 'chr1', start: 1000, end: 2000, regionNumber: 0 },
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
      numReads: 1,
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
      { refName: 'chr1', start: 1000, end: 2000, regionNumber: 0 },
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
    expect(result.lines[0]!.colorType).toBe(3)
    expect(result.lines[1]!.colorType).toBe(3)
  })

  test('inter-chromosomal produces nothing when drawInter=false', () => {
    const data = makePileupData({
      numReads: 1,
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
      { refName: 'chr1', start: 1000, end: 2000, regionNumber: 0 },
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
      numReads: 1,
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
      { refName: 'chr1', start: 1000, end: 2000, regionNumber: 0 },
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
      numReads: 1,
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
      { refName: 'chr1', start: 1000, end: 2000, regionNumber: 0 },
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
      numReads: 1,
      regionStart: 1000,
      readPositions: new Uint32Array([0, 500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      readNames: ['readA'],
      readSuppAlignments: ['chr1,3001,+,200M,60,0;'],
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, regionNumber: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'normal',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.p1.bp).toBe(1500)
    expect(result.arcs[0]!.p2.bp).toBe(3000)
  })

  test('cross-region reads (same name in two regions) produce arcs', () => {
    const data0 = makePileupData({
      numReads: 1,
      regionStart: 1000,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
    })
    const data1 = makePileupData({
      numReads: 1,
      regionStart: 5000,
      readPositions: new Uint32Array([0, 100]),
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
      { refName: 'chr1', start: 1000, end: 2000, regionNumber: 0 },
      { refName: 'chr1', start: 5000, end: 6000, regionNumber: 1 },
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
      numReads: 1,
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
    const regions = [{ refName: 'chr1', start: 0, end: 1000, regionNumber: 0 }]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'orientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.colorType).toBe(6)
  })

  test('gradient coloring gives colorType 8', () => {
    const data = makePileupData({
      numReads: 1,
      regionStart: 0,
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
      readNextRefs: ['chr1'],
      readNextPositions: new Uint32Array([500]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [{ refName: 'chr1', start: 0, end: 1000, regionNumber: 0 }]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'gradient',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.colorType).toBe(8)
  })

  test('insert size coloring uses worker-provided insertSizeStats', () => {
    const data = makePileupData({
      numReads: 1,
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
    const regions = [{ refName: 'chr1', start: 0, end: 1000, regionNumber: 0 }]
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
      numReads: 1,
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
      { refName: 'chr1', start: 0, end: 600000, regionNumber: 0 },
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
})

describe('arcsToRegionResult', () => {
  test('filters arcs to only matching region', () => {
    const arcs = [
      {
        p1: { refName: 'chr1', bp: 1100 },
        p2: { refName: 'chr1', bp: 1500 },
        colorType: 0,
        isArc: 0,
      },
      {
        p1: { refName: 'chr2', bp: 5000 },
        p2: { refName: 'chr2', bp: 6000 },
        colorType: 1,
        isArc: 1,
      },
    ]
    const lines = [
      { x: { refName: 'chr1', bp: 1200 }, colorType: 3 },
      { x: { refName: 'chr2', bp: 5500 }, colorType: 3 },
    ]

    const result = arcsToRegionResult(arcs, lines, 'chr1', 1000, 200)

    expect(result.numArcs).toBe(1)
    expect(result.arcX1[0]).toBe(100)
    expect(result.arcX2[0]).toBe(500)
    expect(result.numLines).toBe(1)
    expect(result.linePositions[0]).toBe(200)
  })

  test('returns empty arrays when no arcs match region', () => {
    const arcs = [
      {
        p1: { refName: 'chr2', bp: 5000 },
        p2: { refName: 'chr2', bp: 6000 },
        colorType: 0,
        isArc: 0,
      },
    ]
    const result = arcsToRegionResult(arcs, [], 'chr1', 1000, 200)

    expect(result.numArcs).toBe(0)
    expect(result.arcX1.length).toBe(0)
    expect(result.numLines).toBe(0)
  })

  test('line Y values span 0 to height', () => {
    const lines = [{ x: { refName: 'chr1', bp: 1500 }, colorType: 3 }]
    const result = arcsToRegionResult([], lines, 'chr1', 1000, 300)

    expect(result.numLines).toBe(1)
    expect(result.lineYs[0]).toBe(0)
    expect(result.lineYs[1]).toBe(300)
  })
})

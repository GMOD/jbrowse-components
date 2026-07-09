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
    mismatchQuals: new Uint8Array(0),
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

  test('lone paired read with a mapped mate AND an SA tag draws both links', () => {
    // Mate mapped off-screen at chr1:2000 and a supplementary block at
    // chr1:3001. Both the mate link and the SA split junction must be emitted —
    // the mate being off-screen must not suppress the within-read junction.
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      readNames: ['readA'],
      readNextRefs: ['chr1'],
      readNextPositions: new Uint32Array([2000]),
      readSuppAlignments: ['chr1,3001,+,200M,60,0;'],
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    // Both endpoints leave the read's 3' edge (1500): one reaches the mate
    // (2000), the other the supplementary block's 5' edge (3000).
    const p2s = result.arcs.map(a => a.p2.bp).sort((a, b) => a - b)
    expect(result.arcs.every(a => a.p1.bp === 1500)).toBe(true)
    expect(p2s).toEqual([2000, 3000])
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

    // Mates are distinct records: distinct fileOffsets => distinct f.id(). (The
    // helper's per-array id${i} would collide both on 'id0', which can't happen
    // in real data and would trip the same-read cross-region dedup.)
    data0.readIds[0] = 'readA-mate1'
    data1.readIds[0] = 'readA-mate2'

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

  test('read cloud SA-tag arcs color by strand like arcs (inversion→7, same-strand→8)', () => {
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
    // Same strand (+/+) → split-deletion slot 8 (yellow)
    expect(
      computeArcsFromPileupData(new Map([[0, mkSplit(1, '+')]]), regions, opts)
        .arcs[0]!.colorType,
    ).toBe(8)
    // Opposite strand (+/-) → split-inversion slot 7 (magenta)
    expect(
      computeArcsFromPileupData(new Map([[0, mkSplit(1, '-')]]), regions, opts)
        .arcs[0]!.colorType,
    ).toBe(7)
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
    // opposite strands → split-inversion slot 7 (magenta arc)
    expect(inv[0]!.colorType).toBe(7)

    // same strands → split-deletion slot 8, still dashed split
    const del = computeArcsFromPileupData(
      new Map([[0, mkInViewSplit(1, 1)]]),
      regions,
      opts,
    ).arcs
    expect(del[0]!.shapeType).toBe(ARC_SHAPE_FLAT_SPLIT)
    expect(del[0]!.colorType).toBe(8)
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
      readPositions: new Uint32Array([1000, 1200, 2000, 2200, 3000, 3200]),
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

  test('multi-entry split read steps through an off-screen segment, not across it', () => {
    // Two on-screen segments A (clip 0, chr1:1000) and C (clip 200, chr1:5000)
    // of one unpaired read; the middle segment B (clip 100) maps off-screen at
    // chr1:9000 and is known only from the SA tags. The chain must be A→B→C, not
    // a single misleading A→C join across the hidden segment.
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1200, 5000, 5200]),
      readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([0, 0]),
      readPairOrientations: new Uint8Array([0, 0]),
      readNames: ['readA', 'readA'],
      readClipAtStart: new Uint32Array([0, 200]),
      readSuppAlignments: [
        // A's SA names B (off-screen) and C
        'chr1,9001,+,100S200M,60,0;chr1,5001,+,200S200M,60,0;',
        // C's SA names A and B (off-screen)
        'chr1,1001,+,200M200S,60,0;chr1,9001,+,100S200M,60,0;',
      ],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]
    const withLongRange = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: true,
      },
    ).arcs
    // A→B (1200→9000) and B→C (9200→5000); never the direct A→C (1200→5000)
    expect(withLongRange.map(a => [a.p1.bp, a.p2.bp])).toEqual([
      [1200, 9000],
      [9200, 5000],
    ])
    expect(withLongRange.some(a => a.p1.bp === 1200 && a.p2.bp === 5000)).toBe(
      false,
    )

    // with long-range off, the flanking segments are not read-adjacent, so
    // nothing is drawn rather than the misleading direct join
    const withoutLongRange = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: false,
      },
    ).arcs
    expect(withoutLongRange).toHaveLength(0)
  })

  test('paired + SA-split: split junction colored by its own strands, not pair', () => {
    // read1 (first-in-pair) is SA-split fwd→rev — an inversion junction — and
    // read2 (second-in-pair) is its mate. The dataset is paired (global
    // hasPaired=true), but the split junction must still color by its segment
    // strands (split-inversion slot 7), not fall into the paired insert-size
    // branch.
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
    // Colored split-inversion (7) by its own strands — NOT the paired
    // insert-size default (0) the global hasPaired branch would have produced.
    expect(arcs[0]!.colorType).toBe(7)
    // arc[1] = the read1↔read2 mate link, still colored by pair semantics.
    expect([arcs[1]!.p1.bp, arcs[1]!.p2.bp]).toEqual([1200, 5000])
  })

  test('paired multi-segment read steps through an off-screen 3rd split segment', () => {
    // First-in-pair read has two on-screen segments A (clip 0, chr1:1000) and C
    // (clip 200, chr1:5000) plus a middle segment B (clip 100) mapped off-screen
    // at chr1:9000, known only from the SA tags. Its mate D (second-in-pair) is
    // on screen at chr1:5500. Previously the ≥2-on-screen paired branch chained
    // only the entries it was handed, so it drew a misleading direct A→C join
    // and never stepped through B. It must now behave like the unpaired path:
    // A→B→C when long-range is on, nothing within the read when it is off.
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1200, 5000, 5200, 5500, 5700]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ]),
      readStrands: new Int8Array([1, 1, -1]),
      readInsertSizes: new Float32Array([600, 0, 600]),
      readPairOrientations: new Uint8Array([1, 0, 1]),
      readNames: ['readA', 'readA', 'readA'],
      readClipAtStart: new Uint32Array([0, 200, 0]),
      readSuppAlignments: [
        // A's SA names B (off-screen) and C
        'chr1,9001,+,100S200M,60,0;chr1,5001,+,200S200M,60,0;',
        // C's SA names A and B (off-screen)
        'chr1,1001,+,200M200S,60,0;chr1,9001,+,100S200M,60,0;',
        // mate D has no supplementary alignments
        '',
      ],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]

    const withLongRange = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: true,
      },
    ).arcs
    const pairs = withLongRange.map(a => [a.p1.bp, a.p2.bp])
    // A→B (1200→9000) and B→C (9200→5000) step through the hidden segment...
    expect(pairs).toContainEqual([1200, 9000])
    expect(pairs).toContainEqual([9200, 5000])
    // ...never the direct A→C join (1200→5000) the old branch produced...
    expect(pairs).not.toContainEqual([1200, 5000])
    // ...plus the mate link A↔D (fwd 3' end 1200 → reverse mate's 5500).
    expect(pairs).toContainEqual([1200, 5500])
    expect(withLongRange).toHaveLength(3)

    // With long-range off, B can't be drawn and A/C are not read-adjacent, so no
    // within-read junction is drawn — but the on-screen mate link still is.
    const withoutLongRange = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: false,
      },
    ).arcs
    expect(withoutLongRange.map(a => [a.p1.bp, a.p2.bp])).toEqual([
      [1200, 5500],
    ])
  })

  test('mixed dataset: a lone unpaired SA read draws its split junction, not a mate arc', () => {
    // A paired pair (idx 0/1, both mates on screen) makes the dataset globally
    // paired, alongside a lone unpaired read (idx 2) carrying an SA tag (its
    // supplementary is off-screen). The single-entry path must key off the
    // read's own PAIRED flag: the lone read is unpaired, so it draws an SA split
    // junction rather than a spurious mate arc to readNextPositions (0 for an
    // unpaired read).
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1200, 1800, 2000, 5000, 5200]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
        0,
      ]),
      readStrands: new Int8Array([1, -1, 1]),
      readInsertSizes: new Float32Array([1000, 1000, 0]),
      readPairOrientations: new Uint8Array([1, 1, 0]),
      readNames: ['pair', 'pair', 'lone'],
      readSuppAlignments: ['', '', 'chr1,7001,+,200M,60,0;'],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 8000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    // one mate-link arc for the pair + one SA split junction for the lone read
    expect(arcs).toHaveLength(2)
    const loneArc = arcs.find(a => a.p1.bp === 5200)!
    // lone read's SA junction: primary fwd end (5200) → supplementary fwd
    // start (7000), NOT a mate arc to position 0
    expect(loneArc.p2.bp).toBe(7000)
  })

  test('wide inversion split keeps its inversion color in a paired dataset', () => {
    // A paired pair (idx 0/1) makes the dataset globally paired and gives the
    // long-range threshold a finite value. A lone unpaired read (idx 2) is
    // SA-split fwd→rev spanning >10kb — its |gap|/2 clears both the
    // long-range and the 10kb large-insert threshold. The split must still
    // color by its own strands (split-inversion slot 7), NOT get repainted
    // long-insert (slot 1) by the paired-only large-insert override.
    const data = makePileupData({
      regionStart: 1000,
      readPositions: new Uint32Array([1000, 1200, 1400, 1600, 1000, 1500]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
        0,
      ]),
      readStrands: new Int8Array([1, -1, 1]),
      readInsertSizes: new Float32Array([200, 200, 0]),
      readPairOrientations: new Uint8Array([1, 1, 0]),
      readNames: ['pair', 'pair', 'lone'],
      readSuppAlignments: ['', '', 'chr1,30001,-,200M,60,0;'],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 40000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    const loneArc = arcs.find(a => a.p1.bp === 1500)!
    // |30200 - 1500| / 2 ≈ 14350 > 10000 large-insert threshold
    expect(Math.abs((loneArc.p2.bp - loneArc.p1.bp) / 2)).toBeGreaterThan(10000)
    // fwd→rev split junction → split-inversion slot 7, not long-insert 1
    expect(loneArc.colorType).toBe(7)
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

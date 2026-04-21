import {
  buildChainConnectingData,
  computeChainLayout,
  computeMultiRegionChainLayout,
  readYsFromRowMap,
} from './computeChainLayout.ts'

import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'

function makeChainData(opts: {
  regionStart: number
  chains: {
    name: string
    minStart: number
    maxEnd: number
    distance: number
    numReads?: number
    hasSupp?: boolean
    colorType?: number
  }[]
}): PileupDataResult {
  const { chains } = opts
  const numChains = chains.length
  const numReads = chains.reduce((n, c) => n + (c.numReads ?? 1), 0)

  const chainAbsMinStarts = new Uint32Array(numChains)
  const chainAbsMaxEnds = new Uint32Array(numChains)
  const chainDistances = new Uint32Array(numChains)
  const chainNames: string[] = []
  const chainHasMultiple = new Uint8Array(numChains)
  const chainFirstReadIndices = new Uint32Array(numChains)
  const readChainIndices = new Uint32Array(numReads)

  let readIdx = 0
  for (const [ci, chain] of chains.entries()) {
    const n = chain.numReads ?? 1
    chainAbsMinStarts[ci] = chain.minStart
    chainAbsMaxEnds[ci] = chain.maxEnd
    chainDistances[ci] = chain.distance
    chainNames.push(chain.name)
    chainHasMultiple[ci] = n >= 2 ? 1 : 0
    chainFirstReadIndices[ci] = readIdx
    for (let r = 0; r < n; r++) {
      readChainIndices[readIdx++] = ci
    }
  }

  const readIds = Array.from({ length: numReads }, (_, i) => `id${i}`)

  return {
    numReads,
    readChainIndices,
    chainNames,
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainHasMultiple,
    chainFirstReadIndices,
    maxY: 0,
    readIds,
    readNames: readIds.slice(),
    readPositions: new Uint32Array(numReads * 2),
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
    coverageStartPos: 0,
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
    sashimiX1: new Uint32Array(0),
    sashimiX2: new Uint32Array(0),
    sashimiScores: new Float32Array(0),
    sashimiColorTypes: new Uint8Array(0),
    sashimiCounts: new Uint32Array(0),
    numSashimiArcs: 0,
    numGaps: 0,
    numMismatches: 0,
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
  }
}

describe('computeChainLayout', () => {
  test('single chain with one read is placed at row 0', () => {
    const data = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'readA', minStart: 1000, maxEnd: 1100, distance: 100 }],
    })
    const { readYs, maxY } = computeChainLayout(data)
    expect(readYs[0]).toBe(0)
    expect(maxY).toBe(1)
  })

  test('empty data returns maxY 0', () => {
    const data = makeChainData({ regionStart: 1000, chains: [] })
    const { maxY } = computeChainLayout(data)
    expect(maxY).toBe(0)
  })

  test('two non-overlapping chains pack into the same row', () => {
    const data = makeChainData({
      regionStart: 1000,
      chains: [
        { name: 'readA', minStart: 1000, maxEnd: 1100, distance: 100 },
        { name: 'readB', minStart: 1200, maxEnd: 1300, distance: 100 },
      ],
    })
    const { readYs, maxY } = computeChainLayout(data)
    expect(readYs[0]).toBe(readYs[1])
    expect(maxY).toBe(1)
  })

  test('two overlapping chains are placed on different rows', () => {
    const data = makeChainData({
      regionStart: 1000,
      chains: [
        { name: 'readA', minStart: 1000, maxEnd: 1200, distance: 200 },
        { name: 'readB', minStart: 1100, maxEnd: 1300, distance: 200 },
      ],
    })
    const { readYs, maxY } = computeChainLayout(data)
    expect(readYs[0]).not.toBe(readYs[1])
    expect(maxY).toBe(2)
  })

  test('gap-filling: chains non-overlapping despite distance-sort order both fit in one row', () => {
    // Chain A has shorter distance so it's placed first, but starts later.
    // Chain B has longer distance so it's placed second, but starts earlier.
    // A simple greedy levels array would put B on row 1 because A's right edge
    // (602) is > B's start (100). GranularRectLayout detects the gap and fits
    // both chains into row 0.
    const data = makeChainData({
      regionStart: 0,
      chains: [
        { name: 'readA', minStart: 500, maxEnd: 600, distance: 100 },
        { name: 'readB', minStart: 100, maxEnd: 200, distance: 300 },
      ],
    })
    const { readYs, maxY } = computeChainLayout(data)
    expect(readYs[0]).toBe(readYs[1]) // both in row 0 — no overlap
    expect(maxY).toBe(1)
  })

  test('all reads in the same chain share a row', () => {
    const data = makeChainData({
      regionStart: 1000,
      chains: [
        {
          name: 'readA',
          minStart: 1000,
          maxEnd: 1500,
          distance: 500,
          numReads: 2,
        },
      ],
    })
    const { readYs } = computeChainLayout(data)
    expect(readYs[0]).toBe(readYs[1])
  })
})

describe('computeMultiRegionChainLayout — cross-region consistency', () => {
  test('same chain name in two regions gets the same row', () => {
    const region1 = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'readA', minStart: 1000, maxEnd: 1100, distance: 300 }],
    })
    const region2 = makeChainData({
      regionStart: 1300,
      chains: [{ name: 'readA', minStart: 1300, maxEnd: 1400, distance: 300 }],
    })

    const { rowMap } = computeMultiRegionChainLayout([
      [0, region1],
      [1, region2],
    ])

    const ys1 = readYsFromRowMap(region1, rowMap)
    const ys2 = readYsFromRowMap(region2, rowMap)
    expect(ys1[0]).toBe(ys2[0])
  })

  test('bounds are merged across regions for the same chain name', () => {
    // readA appears in both regions; its merged span is [1000, 1400].
    // readB exists only in region2 at [1050, 1350], overlapping the merged readA span.
    // They must land on different rows.
    const region1 = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'readA', minStart: 1000, maxEnd: 1100, distance: 300 }],
    })
    const region2 = makeChainData({
      regionStart: 1300,
      chains: [
        { name: 'readA', minStart: 1300, maxEnd: 1400, distance: 300 },
        { name: 'readB', minStart: 1050, maxEnd: 1350, distance: 300 },
      ],
    })

    const { rowMap } = computeMultiRegionChainLayout([
      [0, region1],
      [1, region2],
    ])

    expect(rowMap.get('readA')).not.toBe(rowMap.get('readB'))
  })

  test('non-overlapping chains in different regions share a row', () => {
    const region1 = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'readA', minStart: 1000, maxEnd: 1100, distance: 100 }],
    })
    const region2 = makeChainData({
      regionStart: 5000,
      chains: [{ name: 'readB', minStart: 5000, maxEnd: 5100, distance: 100 }],
    })

    const { rowMap } = computeMultiRegionChainLayout([
      [0, region1],
      [1, region2],
    ])

    expect(rowMap.get('readA')).toBe(rowMap.get('readB'))
  })

  test('distance-sort inconsistency: per-region would give mates different rows, cross-region does not', () => {
    // Region 1: readB has shorter distance (d=50) so it gets placed first at row 0.
    // readA overlaps readB's range, forcing readA to row 1.
    // Region 2: readA's reverse mate is the only chain, so per-region it lands at row 0.
    // Cross-region merges readA's bounds ([200,700]) and readB's bounds ([100,400]),
    // applies the same distance-sort globally, and readA gets row 1 in BOTH regions.
    const region1 = makeChainData({
      regionStart: 100,
      chains: [
        { name: 'readA', minStart: 200, maxEnd: 300, distance: 300 },
        { name: 'readB', minStart: 100, maxEnd: 400, distance: 50 },
      ],
    })
    const region2 = makeChainData({
      regionStart: 600,
      chains: [{ name: 'readA', minStart: 600, maxEnd: 700, distance: 300 }],
    })

    const { rowMap } = computeMultiRegionChainLayout([
      [0, region1],
      [1, region2],
    ])

    const ys1 = readYsFromRowMap(region1, rowMap)
    const ys2 = readYsFromRowMap(region2, rowMap)

    // read index 0 = readA in region1 (first chain), read index 1 = readB in region1
    const readARow_region1 = ys1[0]!
    const readBRow_region1 = ys1[1]!
    const readARow_region2 = ys2[0]!

    // readA must be on the same row in both regions
    expect(readARow_region1).toBe(readARow_region2)
    // readA and readB overlap so they must be on different rows
    expect(readARow_region1).not.toBe(readBRow_region1)
  })

  test('same chain across three regions gets the same row in all three', () => {
    const region1 = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'readA', minStart: 1000, maxEnd: 1100, distance: 500 }],
    })
    const region2 = makeChainData({
      regionStart: 3000,
      chains: [{ name: 'readA', minStart: 3000, maxEnd: 3100, distance: 500 }],
    })
    const region3 = makeChainData({
      regionStart: 5000,
      chains: [{ name: 'readA', minStart: 5000, maxEnd: 5100, distance: 500 }],
    })

    const { rowMap } = computeMultiRegionChainLayout([
      [0, region1],
      [1, region2],
      [2, region3],
    ])

    const ys1 = readYsFromRowMap(region1, rowMap)
    const ys2 = readYsFromRowMap(region2, rowMap)
    const ys3 = readYsFromRowMap(region3, rowMap)

    expect(ys1[0]).toBe(ys2[0])
    expect(ys2[0]).toBe(ys3[0])
  })

  test('multiple mate pairs each stay together across regions', () => {
    // readA fwd in region1, readA rev in region2 — should share a row.
    // readB fwd in region1, readB rev in region2 — should share a row.
    // readA and readB overlap → they must be on different rows.
    const region1 = makeChainData({
      regionStart: 1000,
      chains: [
        { name: 'readA', minStart: 1000, maxEnd: 1200, distance: 400 },
        { name: 'readB', minStart: 1100, maxEnd: 1300, distance: 400 },
      ],
    })
    const region2 = makeChainData({
      regionStart: 1400,
      chains: [
        { name: 'readA', minStart: 1400, maxEnd: 1500, distance: 400 },
        { name: 'readB', minStart: 1400, maxEnd: 1500, distance: 400 },
      ],
    })

    const { rowMap } = computeMultiRegionChainLayout([
      [0, region1],
      [1, region2],
    ])

    const ys1 = readYsFromRowMap(region1, rowMap)
    const ys2 = readYsFromRowMap(region2, rowMap)

    // read 0 = readA in region1, read 1 = readB in region1
    const readARow_r1 = ys1[0]!
    const readBRow_r1 = ys1[1]!
    // read 0 = readA in region2, read 1 = readB in region2
    const readARow_r2 = ys2[0]!
    const readBRow_r2 = ys2[1]!

    // Each pair is consistent across regions
    expect(readARow_r1).toBe(readARow_r2)
    expect(readBRow_r1).toBe(readBRow_r2)
    // The two pairs are on different rows
    expect(readARow_r1).not.toBe(readBRow_r1)
  })

  test('chain only present in one region still gets a row assigned', () => {
    // readA is in region1 only, readB is in region2 only — both should get valid rows
    const region1 = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'readA', minStart: 1000, maxEnd: 1100, distance: 100 }],
    })
    const region2 = makeChainData({
      regionStart: 2000,
      chains: [{ name: 'readB', minStart: 2000, maxEnd: 2100, distance: 100 }],
    })

    const { rowMap } = computeMultiRegionChainLayout([
      [0, region1],
      [1, region2],
    ])

    expect(rowMap.has('readA')).toBe(true)
    expect(rowMap.has('readB')).toBe(true)
    const ys1 = readYsFromRowMap(region1, rowMap)
    const ys2 = readYsFromRowMap(region2, rowMap)
    expect(ys1[0]).toBeGreaterThanOrEqual(0)
    expect(ys2[0]).toBeGreaterThanOrEqual(0)
  })
})

describe('buildChainConnectingData', () => {
  test('no connecting line for single-read chain', () => {
    const data = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'readA', minStart: 1000, maxEnd: 1100, distance: 100 }],
    })
    const readYs = new Uint16Array([3])
    const out = buildChainConnectingData(data, readYs)
    expect(out.numConnectingLines).toBe(0)
    expect(out.connectingLinePositions.length).toBe(0)
  })

  test('connecting line emitted for chain with multiple reads', () => {
    const data = makeChainData({
      regionStart: 1000,
      chains: [
        {
          name: 'readA',
          minStart: 1000,
          maxEnd: 1400,
          distance: 400,
          numReads: 2,
        },
      ],
    })
    const readYs = new Uint16Array([2, 2])
    const out = buildChainConnectingData(data, readYs)
    expect(out.numConnectingLines).toBe(1)
    expect(out.connectingLineYs[0]).toBe(2)
    expect(out.connectingLinePositions[0]).toBe(1000) // absolute minStart
    expect(out.connectingLinePositions[1]).toBe(1400) // absolute maxEnd
  })

  test('flatbush spatial index is built for non-empty chains', () => {
    const data = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'readA', minStart: 1000, maxEnd: 1200, distance: 200 }],
    })
    const readYs = new Uint16Array([0])
    const out = buildChainConnectingData(data, readYs)
    expect(out.chainFlatbushData).toBeDefined()
    expect(out.chainFlatbushData!.byteLength).toBeGreaterThan(0)
  })

  test('line uses absolute chain extents, GPU scissor handles off-screen clipping', () => {
    const data = makeChainData({
      regionStart: 1000,
      chains: [
        {
          name: 'readA',
          minStart: 900,
          maxEnd: 1200,
          distance: 300,
          numReads: 2,
        },
      ],
    })
    const readYs = new Uint16Array([0, 0])
    const out = buildChainConnectingData(data, readYs)
    expect(out.connectingLinePositions[0]).toBe(900) // absolute minStart
    expect(out.connectingLinePositions[1]).toBe(1200) // absolute maxEnd
  })
})

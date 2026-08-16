import { emptyModTooltipIndex } from '../shared/modTooltipIndex.ts'
import { namesToBlock } from '../shared/readNameBlock.ts'
import { nextRefsToTable } from '../shared/readNextRefs.ts'
import {
  buildChainConnectingData,
  computeChainLayout,
  computeMultiRegionChainLayout,
  readYsFromRowMap,
} from './computeChainLayout.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

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

  const readKeys = Array.from({ length: numReads }, (_, i) => `id${i}`)

  return {
    readIdPrefix: undefined,
    ...emptyModTooltipIndex(),
    ...nextRefsToTable(Array.from({ length: numReads }, () => '')),
    readChainIndices,
    chainNames,
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainHasMultiple,
    chainFirstReadIndices,
    maxY: 0,
    readKeys,
    ...namesToBlock(readKeys.slice()),
    readPositions: new Uint32Array(numReads * 2),
    readYs: new Uint16Array(numReads),
    readFlags: new Uint16Array(numReads),
    readMapqs: new Uint8Array(numReads),
    readInsertSizes: new Float32Array(numReads),
    readPairOrientations: new Uint8Array(numReads),
    readStrands: new Int8Array(numReads),
    readInterchrom: new Uint8Array(numReads),
    readTagColors: new Uint32Array(0),
    readColorCategories: new Uint8Array(0),
    segmentPositions: new Uint32Array(0),
    segmentReadIndices: new Uint32Array(0),
    segmentEdgeFlags: new Uint8Array(0),
    numSegments: 0,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
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
    interbaseLengths: new Uint32Array(0),
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
    snpPackedBuffer: new ArrayBuffer(0),
    interbaseMaxCount: 0,
    interbasePackedBuffer: new ArrayBuffer(0),
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
    modCovPackedBuffer: new ArrayBuffer(0),
    sashimiX1: new Uint32Array(0),
    sashimiX2: new Uint32Array(0),
    sashimiStrands: new Int8Array(0),
    sashimiCounts: new Uint32Array(0),
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

  // Distance is `maxEnd - minStart` (or |TLEN|), so a fixed-length read set ties
  // on it for every chain. Placement is first-fit-lowest-row and JS sort is
  // stable, so without a total tiebreak the rows fell out of the worker's emit
  // order rather than out of the chain set.
  test('row assignment does not depend on chain emit order', () => {
    const chains = [
      { name: 'readA', minStart: 1000, maxEnd: 1150, distance: 150 },
      { name: 'readB', minStart: 1050, maxEnd: 1200, distance: 150 },
      { name: 'readC', minStart: 1100, maxEnd: 1250, distance: 150 },
      { name: 'readD', minStart: 1300, maxEnd: 1450, distance: 150 },
    ]
    const forward = computeMultiRegionChainLayout([
      [0, makeChainData({ regionStart: 1000, chains })],
    ])
    const reversed = computeMultiRegionChainLayout([
      [0, makeChainData({ regionStart: 1000, chains: [...chains].reverse() })],
    ])
    expect([...reversed.rowMap]).toStrictEqual([...forward.rowMap])
    expect(reversed.maxY).toBe(forward.maxY)
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

  // `distance` orders the packing (ascending — tightest to the lowest rows), and
  // for the case this layout exists to serve every region understates it: a
  // fusion's read is a singleton in each of the two windows, so the chain that
  // crosses the whole view reported one alignment's length and packed among the
  // tight ones. The merged span is what it actually reaches.
  test('a chain crossing regions packs by its merged reach', () => {
    const wideL = makeChainData({
      regionStart: 1000,
      chains: [{ name: 'wide', minStart: 1000, maxEnd: 1100, distance: 100 }],
    })
    const wideR = makeChainData({
      regionStart: 9000,
      chains: [
        { name: 'wide', minStart: 9000, maxEnd: 9100, distance: 100 },
        // Longer than either of `wide`'s per-region spans, so the old key sorted
        // it AFTER `wide` — and since it sits inside `wide`'s merged span the
        // two collide, which is what makes the order decide the rows. `wide`
        // really reaches 8100, so it is the one that belongs below.
        { name: 'local', minStart: 2000, maxEnd: 2400, distance: 400 },
      ],
    })

    const { rowMap } = computeMultiRegionChainLayout([
      [0, wideL],
      [1, wideR],
    ])
    expect(rowMap.get('local')!).toBeLessThan(rowMap.get('wide')!)
  })

  // ...and the same two windows on two CHROMOSOMES must not, which the test
  // above cannot say: it passes no `regions`, so every region's refName is
  // `undefined`, `refNameAxisShift` is identity, and the merged bounds stay
  // genuine genomic coordinates. Give it a real `regions` map and the shift lays
  // the two refNames end to end, so `maxEnd - minStart` measures across a
  // synthetic axis — a number with no genomic meaning that is nonetheless larger
  // than any local chain's span by construction. Sorted on that, every
  // cross-chromosome chain lands behind every local one, and a fusion view's own
  // read support goes below the fold of a row-capped pileup.
  test('a chain crossing CHROMOSOMES packs by its reach, not the axis gap', () => {
    const onChr9 = makeChainData({
      regionStart: 1000,
      chains: [
        { name: 'fusion', minStart: 1000, maxEnd: 1100, distance: 100 },
        // What gives chr9's axis segment its length — a real window is thousands
        // of bp wide because reads span it, and that length is precisely what
        // the discarded rule was charging `fusion` for.
        { name: 'chr9wide', minStart: 1000, maxEnd: 3000, distance: 2000 },
      ],
    })
    // The same coordinates as chr9's window: refNames share the number line,
    // which is why the placement axis has to shift them apart in the first place.
    const onChr22 = makeChainData({
      regionStart: 1000,
      chains: [
        { name: 'fusion', minStart: 1000, maxEnd: 1100, distance: 100 },
        // Overlaps `fusion`'s chr22 end, so the two collide and the packing
        // ORDER is what decides their rows. It reaches 400bp on its own
        // chromosome against `fusion`'s 100 on each of two, so `fusion` is the
        // tighter chain and belongs above it.
        { name: 'local', minStart: 1000, maxEnd: 1400, distance: 400 },
      ],
    })
    const regions = new Map([
      [0, { refName: 'chr9', start: 1000, end: 3000 }],
      [1, { refName: 'chr22', start: 1000, end: 3000 }],
    ])

    const { rowMap } = computeMultiRegionChainLayout(
      [
        [0, onChr9],
        [1, onChr22],
      ],
      regions,
    )
    // Charged the axis gap, `fusion` scored 2104 against `local`'s 400 and went
    // below it; by its reach it scores 100 and takes the row above.
    expect(rowMap.get('fusion')!).toBeLessThan(rowMap.get('local')!)
  })

  // The merged span of a single-region chain IS the span its distance came from,
  // so nothing about the ordinary case may move.
  test('a single-region chain keeps the distance its region reported', () => {
    const chains = [
      { name: 'a', minStart: 1000, maxEnd: 1900, distance: 900 },
      { name: 'b', minStart: 1200, maxEnd: 1300, distance: 100 },
    ]
    const { rowMap } = computeMultiRegionChainLayout([
      [0, makeChainData({ regionStart: 1000, chains })],
    ])
    expect(rowMap.get('b')!).toBeLessThan(rowMap.get('a')!)
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

// Mirrors the pileup path's segmentExtentsByRefName rule (sortLayout.ts):
// refNames share the bp axis but occupy disjoint screen space, so packing them on
// one axis pushed ctgB's chains below every ctgA chain covering the same bp.
describe('computeMultiRegionChainLayout — placement axis is per refName', () => {
  const overlappingBp = [
    { name: 'chainA', minStart: 100, maxEnd: 900, distance: 800 },
  ]
  const regions = new Map([
    [0, { refName: 'ctgA', start: 0, end: 1000 }],
    [1, { refName: 'ctgB', start: 0, end: 1000 }],
  ])

  test('same-bp chains on different refNames share row 0', () => {
    const ctgA = makeChainData({ regionStart: 0, chains: overlappingBp })
    const ctgB = makeChainData({
      regionStart: 0,
      chains: [{ ...overlappingBp[0]!, name: 'chainB' }],
    })

    const { rowMap, maxY } = computeMultiRegionChainLayout(
      [
        [0, ctgA],
        [1, ctgB],
      ],
      regions,
    )

    expect(rowMap.get('chainA')).toBe(0)
    expect(rowMap.get('chainB')).toBe(0)
    expect(maxY).toBe(1)
  })

  test('same-refName chains still collide', () => {
    const region1 = makeChainData({ regionStart: 0, chains: overlappingBp })
    const region2 = makeChainData({
      regionStart: 0,
      chains: [{ ...overlappingBp[0]!, name: 'chainB' }],
    })

    const { maxY } = computeMultiRegionChainLayout(
      [
        [0, region1],
        [1, region2],
      ],
      new Map([
        [0, { refName: 'ctgA', start: 0, end: 1000 }],
        [1, { refName: 'ctgA', start: 0, end: 1000 }],
      ]),
    )

    expect(maxY).toBe(2)
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
    expect(out.connectingLinePositions.length).toBe(0)
    expect(out.connectingLineYs.length).toBe(0)
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
    expect(out.connectingLineYs.length).toBe(1)
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
    expect(out.chainFlatbush).toBeDefined()
    expect(out.chainFlatbush!.numItems).toBeGreaterThan(0)
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

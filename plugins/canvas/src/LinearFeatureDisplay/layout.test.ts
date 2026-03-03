import { computeAndAssignLayout } from './layout.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

function makeFeatureData(opts: {
  regionStart: number
  features: {
    featureId: string
    startBp: number
    endBp: number
    height: number
  }[]
}): FeatureDataResult {
  const { regionStart, features } = opts
  const numRects = features.length
  return {
    regionStart,
    flatbushItems: features.map(f => ({
      featureId: f.featureId,
      type: 'feature',
      startBp: f.startBp,
      endBp: f.endBp,
      layoutEndBp: f.endBp,
      topPx: 0,
      bottomPx: f.height,
      tooltip: f.featureId,
    })),
    subfeatureInfos: [],
    floatingLabelsData: {},
    rectPositions: new Uint32Array(
      features.flatMap(f => [f.startBp - regionStart, f.endBp - regionStart]),
    ),
    rectYs: new Float32Array(numRects),
    rectHeights: new Float32Array(features.map(f => f.height)),
    rectColors: new Uint8Array(numRects * 4),
    numRects,
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
    linePositions: new Uint32Array(0),
    lineYs: new Float32Array(0),
    lineColors: new Uint8Array(0),
    lineDirections: new Int8Array(0),
    numLines: 0,
    lineFeatureIndices: new Uint32Array(0),
    arrowXs: new Uint32Array(0),
    arrowYs: new Float32Array(0),
    arrowDirections: new Int8Array(0),
    arrowHeights: new Float32Array(0),
    arrowColors: new Uint8Array(0),
    numArrows: 0,
    arrowFeatureIndices: new Uint32Array(0),
    maxY: 0,
  }
}

function allRegionNumbers(map: Map<number, FeatureDataResult>) {
  return new Set(map.keys())
}

test('different chromosomes get independent layouts starting at Y=0', () => {
  const ctgAData = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const ctgBData = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f3', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f4', startBp: 200, endBp: 600, height: 20 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([
    [0, ctgAData],
    [1, ctgBData],
  ])
  const regionKeys = new Map([
    [0, 'volvox:ctgA'],
    [1, 'volvox:ctgB'],
  ])

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
  )

  // ctgA: f1 and f2 overlap, so they get different Y values
  const ctgAItem0 = ctgAData.flatbushItems[0]!
  const ctgAItem1 = ctgAData.flatbushItems[1]!
  expect(ctgAItem0.topPx).toBe(0)
  expect(ctgAItem1.topPx).toBeGreaterThan(0)

  // ctgB: f3 and f4 also overlap and get the same layout pattern as ctgA
  // because they have independent layouts. f3 starts at Y=0.
  const ctgBItem0 = ctgBData.flatbushItems[0]!
  const ctgBItem1 = ctgBData.flatbushItems[1]!
  expect(ctgBItem0.topPx).toBe(0)
  expect(ctgBItem1.topPx).toBeGreaterThan(0)

  // Both chromosomes' first features start at Y=0 (independent layouts)
  expect(ctgAItem0.topPx).toBe(ctgBItem0.topPx)
})

test('same chromosome discontiguous regions share layout', () => {
  const region1Data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'spanning', startBp: 50, endBp: 250, height: 20 },
      { featureId: 'local1', startBp: 10, endBp: 90, height: 20 },
    ],
  })
  const region2Data = makeFeatureData({
    regionStart: 200,
    features: [
      { featureId: 'spanning', startBp: 50, endBp: 250, height: 20 },
      { featureId: 'local2', startBp: 210, endBp: 290, height: 20 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([
    [0, region1Data],
    [1, region2Data],
  ])
  const regionKeys = new Map([
    [0, 'hg38:chr1'],
    [1, 'hg38:chr1'],
  ])

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
  )

  // The spanning feature must get the same Y in both regions
  const spanningInR1 = region1Data.flatbushItems.find(
    f => f.featureId === 'spanning',
  )!
  const spanningInR2 = region2Data.flatbushItems.find(
    f => f.featureId === 'spanning',
  )!
  expect(spanningInR1.topPx).toBe(spanningInR2.topPx)

  // local1 overlaps with spanning (both in 10-250 range), so different Y
  const local1 = region1Data.flatbushItems.find(f => f.featureId === 'local1')!
  expect(local1.topPx).not.toBe(spanningInR1.topPx)

  // local2 also overlaps with spanning (210-290 vs 50-250), so different Y
  const local2 = region2Data.flatbushItems.find(f => f.featureId === 'local2')!
  expect(local2.topPx).not.toBe(spanningInR2.topPx)
})

test('non-overlapping features on same chromosome share Y row', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20 },
      { featureId: 'f2', startBp: 300, endBp: 400, height: 20 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
  )

  expect(data.flatbushItems[0]!.topPx).toBe(0)
  expect(data.flatbushItems[1]!.topPx).toBe(0)
})

test('rectYs are updated to match flatbushItem layout positions', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
  )

  for (let i = 0; i < data.numRects; i++) {
    const flatbushIdx = data.rectFeatureIndices[i]!
    expect(data.rectYs[i]).toBe(data.flatbushItems[flatbushIdx]!.topPx)
  }
})

test('different assemblies with same refName get independent layouts', () => {
  const hg38Data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'hg38_f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'hg38_f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const hg19Data = makeFeatureData({
    regionStart: 0,
    features: [{ featureId: 'hg19_f1', startBp: 100, endBp: 500, height: 20 }],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([
    [0, hg38Data],
    [1, hg19Data],
  ])
  const regionKeys = new Map([
    [0, 'hg38:chr1'],
    [1, 'hg19:chr1'],
  ])

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
  )

  expect(hg38Data.flatbushItems[1]!.topPx).toBeGreaterThan(0)
  expect(hg19Data.flatbushItems[0]!.topPx).toBe(0)
})

test('incremental loading does not double-process old data', () => {
  // Step 1: ctgA loads first
  const ctgAData = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })

  const dataMap = new Map<number, FeatureDataResult>([[0, ctgAData]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(dataMap, 1, regionKeys, new Set([0]))

  const f1TopAfterFirst = ctgAData.flatbushItems[0]!.topPx
  const f2TopAfterFirst = ctgAData.flatbushItems[1]!.topPx
  const f1RectYAfterFirst = ctgAData.rectYs[0]!

  // Step 2: ctgB loads incrementally. The dataMap now contains
  // already-processed ctgA data + fresh ctgB data.
  const ctgBData = makeFeatureData({
    regionStart: 0,
    features: [{ featureId: 'f3', startBp: 100, endBp: 500, height: 20 }],
  })

  dataMap.set(1, ctgBData)
  regionKeys.set(1, 'volvox:ctgB')

  // Only ctgB is new
  computeAndAssignLayout(dataMap, 1, regionKeys, new Set([1]))

  // ctgA data must NOT have been re-processed (Y values unchanged)
  expect(ctgAData.flatbushItems[0]!.topPx).toBe(f1TopAfterFirst)
  expect(ctgAData.flatbushItems[1]!.topPx).toBe(f2TopAfterFirst)
  expect(ctgAData.rectYs[0]).toBe(f1RectYAfterFirst)

  // ctgB should be processed correctly
  expect(ctgBData.flatbushItems[0]!.topPx).toBe(0)
})

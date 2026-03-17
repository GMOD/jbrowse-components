import { computeAndAssignLayout, relayoutAllRegions } from './layout.ts'

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
    featureCount: 0,
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

test('relayoutAllRegions at same bpPerPx reproduces original layout', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 25 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(rpcDataMap, 1, regionKeys, allRegionNumbers(rpcDataMap))

  const f1Top = data.flatbushItems[0]!.topPx
  const f2Top = data.flatbushItems[1]!.topPx
  expect(f2Top).toBeGreaterThan(0)

  // Re-layout at same bpPerPx should produce identical result
  relayoutAllRegions(rpcDataMap, 1, regionKeys)

  expect(data.flatbushItems[0]!.topPx).toBe(f1Top)
  expect(data.flatbushItems[1]!.topPx).toBe(f2Top)
  expect(data.flatbushItems[0]!.bottomPx).toBe(f1Top + 20)
  expect(data.flatbushItems[1]!.bottomPx).toBe(f2Top + 25)
})

test('relayoutAllRegions re-lays out features for new bpPerPx', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20 },
      { featureId: 'f2', startBp: 300, endBp: 400, height: 20 },
    ],
  })

  // Add labels that are wide enough to cause collision at higher bpPerPx
  data.floatingLabelsData = {
    f1: {
      featureId: 'f1',
      minX: 100,
      maxX: 200,
      topY: 0,
      featureHeight: 20,
      nameLabel: {
        text: 'Feature One with a long label',
        relativeY: 0,
        color: 'black',
        textWidth: 300,
      },
    },
    f2: {
      featureId: 'f2',
      minX: 300,
      maxX: 400,
      topY: 0,
      featureHeight: 20,
      nameLabel: {
        text: 'Feature Two with a long label',
        relativeY: 0,
        color: 'black',
        textWidth: 300,
      },
    },
  }

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  // At bpPerPx=1, features are 100bp apart, labels are 300px = 300bp wide
  // so they overlap and should be on different rows
  computeAndAssignLayout(rpcDataMap, 1, regionKeys, allRegionNumbers(rpcDataMap))

  const f1Top = data.flatbushItems[0]!.topPx
  const f2Top = data.flatbushItems[1]!.topPx
  expect(f1Top).not.toBe(f2Top)

  // At bpPerPx=0.1, labels are 300px = 30bp wide, features are 100bp apart
  // so they no longer overlap and should share a row
  relayoutAllRegions(rpcDataMap, 0.1, regionKeys)

  expect(data.flatbushItems[0]!.topPx).toBe(0)
  expect(data.flatbushItems[1]!.topPx).toBe(0)
})

test('repeated relayouts do not drift', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(rpcDataMap, 1, regionKeys, allRegionNumbers(rpcDataMap))

  const f1Top = data.flatbushItems[0]!.topPx
  const f2Top = data.flatbushItems[1]!.topPx
  const rectY0 = data.rectYs[0]!
  const rectY1 = data.rectYs[1]!

  for (let i = 0; i < 10; i++) {
    relayoutAllRegions(rpcDataMap, 1, regionKeys)
  }

  expect(data.flatbushItems[0]!.topPx).toBe(f1Top)
  expect(data.flatbushItems[1]!.topPx).toBe(f2Top)
  expect(data.rectYs[0]).toBe(rectY0)
  expect(data.rectYs[1]).toBe(rectY1)
})

test('relayout preserves spanning feature Y across discontiguous regions', () => {
  const region1 = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'spanning', startBp: 50, endBp: 250, height: 20 },
      { featureId: 'local1', startBp: 10, endBp: 90, height: 20 },
    ],
  })
  const region2 = makeFeatureData({
    regionStart: 200,
    features: [
      { featureId: 'spanning', startBp: 50, endBp: 250, height: 20 },
      { featureId: 'local2', startBp: 210, endBp: 290, height: 20 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([
    [0, region1],
    [1, region2],
  ])
  const regionKeys = new Map([
    [0, 'hg38:chr1'],
    [1, 'hg38:chr1'],
  ])

  computeAndAssignLayout(rpcDataMap, 1, regionKeys, allRegionNumbers(rpcDataMap))

  const spanR1 = region1.flatbushItems.find(f => f.featureId === 'spanning')!
  const spanR2 = region2.flatbushItems.find(f => f.featureId === 'spanning')!
  expect(spanR1.topPx).toBe(spanR2.topPx)

  relayoutAllRegions(rpcDataMap, 2, regionKeys)

  const spanR1After = region1.flatbushItems.find(
    f => f.featureId === 'spanning',
  )!
  const spanR2After = region2.flatbushItems.find(
    f => f.featureId === 'spanning',
  )!
  expect(spanR1After.topPx).toBe(spanR2After.topPx)
})

test('relayout correctly handles subfeatureInfos and floatingLabelsData', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'gene1', startBp: 100, endBp: 500, height: 30 },
      { featureId: 'gene2', startBp: 200, endBp: 600, height: 30 },
    ],
  })

  data.subfeatureInfos = [
    {
      featureId: 'exon1',
      parentFeatureId: 'gene1',
      type: 'exon',
      startBp: 150,
      endBp: 200,
      topPx: 5,
      bottomPx: 15,
    },
    {
      featureId: 'exon2',
      parentFeatureId: 'gene2',
      type: 'exon',
      startBp: 300,
      endBp: 350,
      topPx: 5,
      bottomPx: 15,
    },
  ]

  data.floatingLabelsData = {
    gene1: {
      featureId: 'gene1',
      minX: 100,
      maxX: 500,
      topY: 0,
      featureHeight: 30,
      nameLabel: {
        text: 'Gene 1',
        relativeY: 0,
        color: 'black',
        textWidth: 50,
      },
    },
    gene2: {
      featureId: 'gene2',
      minX: 200,
      maxX: 600,
      topY: 0,
      featureHeight: 30,
      nameLabel: {
        text: 'Gene 2',
        relativeY: 0,
        color: 'black',
        textWidth: 50,
      },
    },
  }

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(rpcDataMap, 1, regionKeys, allRegionNumbers(rpcDataMap))

  const gene2Top = data.flatbushItems[1]!.topPx
  expect(gene2Top).toBeGreaterThan(0)

  // Subfeature of gene2 should be offset by gene2's layout Y
  expect(data.subfeatureInfos[1]!.topPx).toBe(5 + gene2Top)
  expect(data.subfeatureInfos[1]!.bottomPx).toBe(15 + gene2Top)

  // Label of gene2 should be offset
  expect(data.floatingLabelsData['gene2']!.topY).toBe(gene2Top)

  // After relayout at same bpPerPx, everything should be identical
  relayoutAllRegions(rpcDataMap, 1, regionKeys)

  const gene2TopAfter = data.flatbushItems[1]!.topPx
  expect(gene2TopAfter).toBe(gene2Top)
  expect(data.subfeatureInfos[1]!.topPx).toBe(5 + gene2TopAfter)
  expect(data.subfeatureInfos[1]!.bottomPx).toBe(15 + gene2TopAfter)
  expect(data.floatingLabelsData['gene2']!.topY).toBe(gene2TopAfter)
})

test('relayout handles lines and arrows', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })

  // Add a line and arrow belonging to f2
  data.linePositions = new Uint32Array([200, 400])
  data.lineYs = new Float32Array([10])
  data.lineColors = new Uint8Array([0, 0, 0, 255])
  data.lineDirections = new Int8Array([1])
  data.numLines = 1
  data.lineFeatureIndices = new Uint32Array([1])

  data.arrowXs = new Uint32Array([600])
  data.arrowYs = new Float32Array([10])
  data.arrowDirections = new Int8Array([1])
  data.arrowHeights = new Float32Array([20])
  data.arrowColors = new Uint8Array([0, 0, 0, 255])
  data.numArrows = 1
  data.arrowFeatureIndices = new Uint32Array([1])

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(rpcDataMap, 1, regionKeys, allRegionNumbers(rpcDataMap))

  const f2Top = data.flatbushItems[1]!.topPx
  expect(f2Top).toBeGreaterThan(0)
  expect(data.lineYs[0]).toBe(10 + f2Top)
  expect(data.arrowYs[0]).toBe(10 + f2Top)

  relayoutAllRegions(rpcDataMap, 1, regionKeys)

  const f2TopAfter = data.flatbushItems[1]!.topPx
  expect(f2TopAfter).toBe(f2Top)
  expect(data.lineYs[0]).toBe(10 + f2TopAfter)
  expect(data.arrowYs[0]).toBe(10 + f2TopAfter)
})

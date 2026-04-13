import {
  computeAndAssignLayout,
  fillYArrays,
  relayoutAllRegions,
} from './layout.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

function makeFeatureData(opts: {
  regionStart: number
  features: {
    featureId: string
    startBp: number
    endBp: number
    height: number
    strand?: number
  }[]
}): FeatureDataResult {
  const { regionStart, features } = opts
  return {
    regionStart,
    flatbushItems: features.map(f => ({
      kind: 'feature' as const,
      featureId: f.featureId,
      type: 'feature',
      startBp: f.startBp,
      endBp: f.endBp,
      topPx: 0,
      bottomPx: f.height,
      featureHeightPx: f.height,
      tooltip: f.featureId,
      strand: f.strand,
    })),
    subfeatureInfos: [],
    floatingLabelsData: {},
    rectPositions: new Uint32Array(
      features.flatMap(f => [f.startBp - regionStart, f.endBp - regionStart]),
    ),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.map(f => f.height)),
    rectColors: new Uint8Array(features.length * 4),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
    linePositions: new Uint32Array(0),
    lineYs: new Float32Array(0),
    lineColors: new Uint8Array(0),
    lineDirections: new Int8Array(0),
    lineFeatureIndices: new Uint32Array(0),
    arrowXs: new Uint32Array(0),
    arrowYs: new Float32Array(0),
    arrowDirections: new Int8Array(0),
    arrowColors: new Uint8Array(0),
    arrowFeatureIndices: new Uint32Array(0),
    featureCount: 0,
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
    true,
    true,
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
    true,
    true,
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
    true,
    true,
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
    true,
    true,
  )

  for (let i = 0; i < data.rectYs.length; i++) {
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
    true,
    true,
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

  computeAndAssignLayout(dataMap, 1, regionKeys, new Set([0]), true, true)

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
  computeAndAssignLayout(dataMap, 1, regionKeys, new Set([1]), true, true)

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

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )

  const f1Top = data.flatbushItems[0]!.topPx
  const f2Top = data.flatbushItems[1]!.topPx
  expect(f2Top).toBeGreaterThan(0)

  // Re-layout at same bpPerPx should produce identical result
  relayoutAllRegions(rpcDataMap, 1, regionKeys, true, true)

  expect(data.flatbushItems[0]!.topPx).toBe(f1Top)
  expect(data.flatbushItems[1]!.topPx).toBe(f2Top)
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
  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )

  const f1Top = data.flatbushItems[0]!.topPx
  const f2Top = data.flatbushItems[1]!.topPx
  expect(f1Top).not.toBe(f2Top)

  // At bpPerPx=0.1, labels are 300px = 30bp wide, features are 100bp apart
  // so they no longer overlap and should share a row
  relayoutAllRegions(rpcDataMap, 0.1, regionKeys, true, true)

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

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )

  const f1Top = data.flatbushItems[0]!.topPx
  const f2Top = data.flatbushItems[1]!.topPx
  const rectY0 = data.rectYs[0]!
  const rectY1 = data.rectYs[1]!

  for (let i = 0; i < 10; i++) {
    relayoutAllRegions(rpcDataMap, 1, regionKeys, true, true)
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

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )

  const spanR1 = region1.flatbushItems.find(f => f.featureId === 'spanning')!
  const spanR2 = region2.flatbushItems.find(f => f.featureId === 'spanning')!
  expect(spanR1.topPx).toBe(spanR2.topPx)

  relayoutAllRegions(rpcDataMap, 2, regionKeys, true, true)

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
      kind: 'subfeature' as const,
      featureId: 'exon1',
      parentFeatureId: 'gene1',
      type: 'exon',
      startBp: 150,
      endBp: 200,
      topPx: 5,
      bottomPx: 15,
    },
    {
      kind: 'subfeature' as const,
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

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )

  const gene2Top = data.flatbushItems[1]!.topPx
  expect(gene2Top).toBeGreaterThan(0)

  // Subfeature of gene2 should be offset by gene2's layout Y
  expect(data.subfeatureInfos[1]!.topPx).toBe(5 + gene2Top)
  expect(data.subfeatureInfos[1]!.bottomPx).toBe(15 + gene2Top)

  // Label of gene2 should be offset
  expect(data.floatingLabelsData.gene2!.topY).toBe(gene2Top)

  // After relayout at same bpPerPx, everything should be identical
  relayoutAllRegions(rpcDataMap, 1, regionKeys, true, true)

  const gene2TopAfter = data.flatbushItems[1]!.topPx
  expect(gene2TopAfter).toBe(gene2Top)
  expect(data.subfeatureInfos[1]!.topPx).toBe(5 + gene2TopAfter)
  expect(data.subfeatureInfos[1]!.bottomPx).toBe(15 + gene2TopAfter)
  expect(data.floatingLabelsData.gene2!.topY).toBe(gene2TopAfter)
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
  data.lineFeatureIndices = new Uint32Array([1])

  data.arrowXs = new Uint32Array([600])
  data.arrowYs = new Float32Array([10])
  data.arrowDirections = new Int8Array([1])
  data.arrowColors = new Uint8Array([0, 0, 0, 255])
  data.arrowFeatureIndices = new Uint32Array([1])

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )

  const f2Top = data.flatbushItems[1]!.topPx
  expect(f2Top).toBeGreaterThan(0)
  expect(data.lineYs[0]).toBe(10 + f2Top)
  expect(data.arrowYs[0]).toBe(10 + f2Top)

  relayoutAllRegions(rpcDataMap, 1, regionKeys, true, true)

  const f2TopAfter = data.flatbushItems[1]!.topPx
  expect(f2TopAfter).toBe(f2Top)
  expect(data.lineYs[0]).toBe(10 + f2TopAfter)
  expect(data.arrowYs[0]).toBe(10 + f2TopAfter)
})

test('layout adds label height when showLabels is true', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 10 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 10 },
    ],
  })

  data.floatingLabelsData = {
    f1: {
      featureId: 'f1',
      minX: 100,
      maxX: 500,
      topY: 0,
      featureHeight: 10,
      nameLabel: {
        text: 'Gene 1',
        relativeY: 0,
        color: 'black',
        textWidth: 50,
      },
      descriptionLabel: {
        text: 'A description',
        relativeY: 12,
        color: 'blue',
        textWidth: 80,
      },
    },
  }

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  // With labels and descriptions on
  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )
  // f1 has height 10 + 5 (padding) + 12 (name) + 12 (desc) = 39
  const f1Bottom = data.flatbushItems[0]!.bottomPx
  expect(f1Bottom).toBe(39)

  // Relayout with labels off
  relayoutAllRegions(rpcDataMap, 1, regionKeys, false, false)
  // f1 has height 10 + 5 (padding) = 15
  const f1BottomNoLabels = data.flatbushItems[0]!.bottomPx
  expect(f1BottomNoLabels).toBe(15)

  // Relayout with labels on again - should return to original
  relayoutAllRegions(rpcDataMap, 1, regionKeys, true, true)
  expect(data.flatbushItems[0]!.bottomPx).toBe(39)
})

test('strand arrow padding prevents adjacent stranded features from sharing a row', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20, strand: 1 },
      { featureId: 'f2', startBp: 208, endBp: 300, height: 20, strand: 1 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )

  expect(data.flatbushItems[1]!.topPx).toBeGreaterThan(0)
})

test('unstranded features that are close together can still share a row', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20 },
      { featureId: 'f2', startBp: 220, endBp: 300, height: 20 },
    ],
  })

  const rpcDataMap = new Map<number, FeatureDataResult>([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  computeAndAssignLayout(
    rpcDataMap,
    1,
    regionKeys,
    allRegionNumbers(rpcDataMap),
    true,
    true,
  )

  // Without strand, no arrow padding, so these don't overlap
  expect(data.flatbushItems[0]!.topPx).toBe(0)
  expect(data.flatbushItems[1]!.topPx).toBe(0)
})

test('fillYArrays is idempotent when called with the same layoutMap', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  data.linePositions = new Uint32Array([200, 400])
  data.lineYs = new Float32Array([7])
  data.lineColors = new Uint8Array([0, 0, 0, 255])
  data.lineDirections = new Int8Array([1])
  data.lineFeatureIndices = new Uint32Array([1])

  const layoutMap = new Map([
    ['f1', 0],
    ['f2', 35],
  ])

  fillYArrays(data, layoutMap)

  const snapshot = {
    f1Top: data.flatbushItems[0]!.topPx,
    f2Top: data.flatbushItems[1]!.topPx,
    rectY0: data.rectYs[0]!,
    rectY1: data.rectYs[1]!,
    lineY0: data.lineYs[0]!,
  }

  // Call again with the same layoutMap — nothing should change
  fillYArrays(data, layoutMap)

  expect(data.flatbushItems[0]!.topPx).toBe(snapshot.f1Top)
  expect(data.flatbushItems[1]!.topPx).toBe(snapshot.f2Top)
  expect(data.rectYs[0]).toBe(snapshot.rectY0)
  expect(data.rectYs[1]).toBe(snapshot.rectY1)
  expect(data.lineYs[0]).toBe(snapshot.lineY0)
})

test('fillYArrays correctly transitions between different layouts', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })

  // First layout: f1 at 0, f2 at 30
  fillYArrays(
    data,
    new Map([
      ['f1', 0],
      ['f2', 30],
    ]),
  )
  expect(data.rectYs[0]).toBe(0)
  expect(data.rectYs[1]).toBe(30)

  // Second layout: swap positions — f1 at 30, f2 at 0
  fillYArrays(
    data,
    new Map([
      ['f1', 30],
      ['f2', 0],
    ]),
  )
  expect(data.rectYs[0]).toBe(30)
  expect(data.rectYs[1]).toBe(0)
  expect(data.flatbushItems[0]!.topPx).toBe(30)
  expect(data.flatbushItems[1]!.topPx).toBe(0)
})

test('fillYArrays handles subfeatures and labels across layout changes', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'gene1', startBp: 100, endBp: 500, height: 30 },
      { featureId: 'gene2', startBp: 200, endBp: 600, height: 30 },
    ],
  })
  data.subfeatureInfos = [
    {
      kind: 'subfeature' as const,
      featureId: 'exon1',
      parentFeatureId: 'gene1',
      type: 'exon',
      startBp: 150,
      endBp: 200,
      topPx: 5,
      bottomPx: 15,
    },
    {
      kind: 'subfeature' as const,
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
    },
    gene2: {
      featureId: 'gene2',
      minX: 200,
      maxX: 600,
      topY: 0,
      featureHeight: 30,
    },
  }

  // Layout 1: gene1 at 0, gene2 at 40
  fillYArrays(
    data,
    new Map([
      ['gene1', 0],
      ['gene2', 40],
    ]),
  )
  expect(data.subfeatureInfos[0]!.topPx).toBe(5)
  expect(data.subfeatureInfos[1]!.topPx).toBe(45)
  expect(data.floatingLabelsData.gene1!.topY).toBe(0)
  expect(data.floatingLabelsData.gene2!.topY).toBe(40)

  // Layout 2: both genes shift — gene1 at 10, gene2 at 50
  fillYArrays(
    data,
    new Map([
      ['gene1', 10],
      ['gene2', 50],
    ]),
  )
  expect(data.subfeatureInfos[0]!.topPx).toBe(15)
  expect(data.subfeatureInfos[0]!.bottomPx).toBe(25)
  expect(data.subfeatureInfos[1]!.topPx).toBe(55)
  expect(data.subfeatureInfos[1]!.bottomPx).toBe(65)
  expect(data.floatingLabelsData.gene1!.topY).toBe(10)
  expect(data.floatingLabelsData.gene2!.topY).toBe(50)

  // Layout 3: back to original — should exactly restore
  fillYArrays(
    data,
    new Map([
      ['gene1', 0],
      ['gene2', 40],
    ]),
  )
  expect(data.subfeatureInfos[0]!.topPx).toBe(5)
  expect(data.subfeatureInfos[1]!.topPx).toBe(45)
  expect(data.floatingLabelsData.gene1!.topY).toBe(0)
  expect(data.floatingLabelsData.gene2!.topY).toBe(40)
})

test('incremental fetch: three batches on same chromosome', () => {
  const makeRegion = (
    regionStart: number,
    localId: string,
    localStart: number,
  ) =>
    makeFeatureData({
      regionStart,
      features: [
        { featureId: 'gene1', startBp: 0, endBp: 1000, height: 30 },
        {
          featureId: localId,
          startBp: localStart,
          endBp: localStart + 100,
          height: 30,
        },
      ],
    })

  const r0 = makeRegion(0, 'loc0', 0)
  const r1 = makeRegion(200, 'loc1', 200)
  const r2 = makeRegion(400, 'loc2', 400)

  const regionKeys = new Map([
    [0, 'hg38:chr1'],
    [1, 'hg38:chr1'],
    [2, 'hg38:chr1'],
  ])

  // Batch 1
  const map1 = new Map<number, FeatureDataResult>([[0, r0]])
  computeAndAssignLayout(map1, 1, regionKeys, new Set([0]), true, true)
  const gene1Y = r0.flatbushItems.find(f => f.featureId === 'gene1')!.topPx

  // Batch 2
  const map2 = new Map<number, FeatureDataResult>([
    [0, r0],
    [1, r1],
  ])
  computeAndAssignLayout(map2, 1, regionKeys, new Set([1]), true, true)

  // Batch 3
  const map3 = new Map<number, FeatureDataResult>([
    [0, r0],
    [1, r1],
    [2, r2],
  ])
  computeAndAssignLayout(map3, 1, regionKeys, new Set([2]), true, true)

  // gene1 should have the same Y in all three regions, unchanged across batches
  const gene1InR0 = r0.flatbushItems.find(f => f.featureId === 'gene1')!
  const gene1InR1 = r1.flatbushItems.find(f => f.featureId === 'gene1')!
  const gene1InR2 = r2.flatbushItems.find(f => f.featureId === 'gene1')!
  expect(gene1InR0.topPx).toBe(gene1Y)
  expect(gene1InR1.topPx).toBe(gene1Y)
  expect(gene1InR2.topPx).toBe(gene1Y)

  // rectYs for gene1 (index 0 in each region) should all match
  expect(r0.rectYs[0]).toBe(r1.rectYs[0])
  expect(r0.rectYs[0]).toBe(r2.rectYs[0])
})

test('incremental fetch with subfeatures preserves correct offsets', () => {
  const r0 = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'gene1', startBp: 0, endBp: 1000, height: 30 },
      { featureId: 'local0', startBp: 0, endBp: 100, height: 30 },
    ],
  })
  r0.subfeatureInfos = [
    {
      kind: 'subfeature' as const,
      featureId: 'exon0',
      parentFeatureId: 'gene1',
      type: 'exon',
      startBp: 50,
      endBp: 90,
      topPx: 5,
      bottomPx: 15,
    },
  ]

  const r1 = makeFeatureData({
    regionStart: 200,
    features: [
      { featureId: 'gene1', startBp: 0, endBp: 1000, height: 30 },
      { featureId: 'local1', startBp: 200, endBp: 300, height: 30 },
    ],
  })
  r1.subfeatureInfos = [
    {
      kind: 'subfeature' as const,
      featureId: 'exon1',
      parentFeatureId: 'gene1',
      type: 'exon',
      startBp: 210,
      endBp: 250,
      topPx: 5,
      bottomPx: 15,
    },
  ]

  const regionKeys = new Map([
    [0, 'hg38:chr1'],
    [1, 'hg38:chr1'],
  ])

  // Batch 1: only r0
  const map1 = new Map<number, FeatureDataResult>([[0, r0]])
  computeAndAssignLayout(map1, 1, regionKeys, new Set([0]), true, true)
  const gene1Y = r0.flatbushItems.find(f => f.featureId === 'gene1')!.topPx
  expect(r0.subfeatureInfos[0]!.topPx).toBe(5 + gene1Y)

  // Batch 2: r1 arrives
  const map2 = new Map<number, FeatureDataResult>([
    [0, r0],
    [1, r1],
  ])
  computeAndAssignLayout(map2, 1, regionKeys, new Set([1]), true, true)

  // Both regions' gene1 subfeatures should be at 5 + gene1Y
  expect(r0.subfeatureInfos[0]!.topPx).toBe(5 + gene1Y)
  expect(r1.subfeatureInfos[0]!.topPx).toBe(5 + gene1Y)
  expect(r0.subfeatureInfos[0]!.bottomPx).toBe(15 + gene1Y)
  expect(r1.subfeatureInfos[0]!.bottomPx).toBe(15 + gene1Y)
})

test('spread then relayout (relayoutForCurrentZoom pattern) gives new reference and correct Y', () => {
  const data = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const regionKeys = new Map([[0, 'chr1']])
  relayoutAllRegions(new Map([[0, data]]), 1, regionKeys, false, false)
  const f1Y = data.flatbushItems[0]!.topPx
  const f2Y = data.flatbushItems[1]!.topPx
  expect(f2Y).toBeGreaterThan(0) // overlapping features on different rows

  // relayoutForCurrentZoom spreads each value to a new object reference
  // so per-region identity tracking in FeatureComponent sees it as changed
  const spread = { ...data }
  expect(spread).not.toBe(data)

  // relayout at same bpPerPx: zero delta, Y values preserved
  relayoutAllRegions(new Map([[0, spread]]), 1, regionKeys, false, false)
  expect(spread.flatbushItems[0]!.topPx).toBe(f1Y)
  expect(spread.flatbushItems[1]!.topPx).toBe(f2Y)
})

test('incremental fetch: old regions do not get double Y offsets', () => {
  // Simulate collapsed introns: multiple regions on same chromosome,
  // same spanning feature in each, fetched in two batches
  const region0 = makeFeatureData({
    regionStart: 0,
    features: [
      { featureId: 'gene1', startBp: 0, endBp: 1000, height: 30 },
      { featureId: 'local0', startBp: 0, endBp: 100, height: 30 },
    ],
  })
  const region1 = makeFeatureData({
    regionStart: 200,
    features: [
      { featureId: 'gene1', startBp: 0, endBp: 1000, height: 30 },
      { featureId: 'local1', startBp: 200, endBp: 300, height: 30 },
    ],
  })
  const region2 = makeFeatureData({
    regionStart: 400,
    features: [
      { featureId: 'gene1', startBp: 0, endBp: 1000, height: 30 },
      { featureId: 'local2', startBp: 400, endBp: 500, height: 30 },
    ],
  })

  const regionKeys = new Map([
    [0, 'hg38:chr1'],
    [1, 'hg38:chr1'],
    [2, 'hg38:chr1'],
  ])

  // Batch 1: regions 0 and 1
  const dataMap1 = new Map<number, FeatureDataResult>([
    [0, region0],
    [1, region1],
  ])
  computeAndAssignLayout(dataMap1, 1, regionKeys, new Set([0, 1]), true, true)

  const gene1InR0After1 = region0.flatbushItems.find(
    f => f.featureId === 'gene1',
  )!
  const gene1InR1After1 = region1.flatbushItems.find(
    f => f.featureId === 'gene1',
  )!
  expect(gene1InR0After1.topPx).toBe(gene1InR1After1.topPx)
  const gene1YAfterBatch1 = gene1InR0After1.topPx

  // Batch 2: region 2 arrives, old regions 0 and 1 are already in the map
  const dataMap2 = new Map<number, FeatureDataResult>([
    [0, region0],
    [1, region1],
    [2, region2],
  ])
  computeAndAssignLayout(dataMap2, 1, regionKeys, new Set([2]), true, true)

  const gene1InR0After2 = region0.flatbushItems.find(
    f => f.featureId === 'gene1',
  )!
  const gene1InR1After2 = region1.flatbushItems.find(
    f => f.featureId === 'gene1',
  )!
  const gene1InR2After2 = region2.flatbushItems.find(
    f => f.featureId === 'gene1',
  )!

  // All regions must have the same Y for the spanning feature
  expect(gene1InR0After2.topPx).toBe(gene1InR1After2.topPx)
  expect(gene1InR0After2.topPx).toBe(gene1InR2After2.topPx)

  // The Y should not have changed from batch 1 (no double-application)
  expect(gene1InR0After2.topPx).toBe(gene1YAfterBatch1)
})

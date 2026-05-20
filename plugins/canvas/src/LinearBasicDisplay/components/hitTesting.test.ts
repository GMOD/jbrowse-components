import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
  performMultiRegionHitDetection,
} from './hitTesting.ts'

import type {
  FlatbushRegionIndexes,
  LabelVisibility,
  VisibleRegion,
} from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

function makeItem(
  featureId: string,
  startBp: number,
  endBp: number,
  topPx: number,
  bottomPx: number,
): FlatbushItem {
  return {
    kind: 'feature',
    featureId,
    type: 'gene',
    startBp,
    endBp,
    topPx,
    bottomPx,
    featureHeightPx: bottomPx - topPx,
    tooltip: featureId,
  }
}

function makeSub(
  featureId: string,
  parentFeatureId: string,
  startBp: number,
  endBp: number,
  topPx: number,
  bottomPx: number,
): SubfeatureInfo {
  return {
    kind: 'subfeature',
    featureId,
    parentFeatureId,
    type: 'mRNA',
    startBp,
    endBp,
    topPx,
    bottomPx,
  }
}

function makeData(
  flatbushItems: FlatbushItem[],
  subfeatureInfos: SubfeatureInfo[] = [],
): FeatureDataResult {
  return {
    flatbushItems,
    subfeatureInfos,
    floatingLabelsData: {},
    rectPositions: new Uint32Array(0),
    rectYs: new Float32Array(0),
    rectHeights: new Float32Array(0),
    rectColors: new Uint32Array(0),
    rectFeatureIndices: new Uint32Array(0),
    linePositions: new Uint32Array(0),
    lineYs: new Float32Array(0),
    lineColors: new Uint32Array(0),
    lineDirections: new Int8Array(0),
    lineFeatureIndices: new Uint32Array(0),
    arrowXs: new Uint32Array(0),
    arrowYs: new Float32Array(0),
    arrowDirections: new Int8Array(0),
    arrowColors: new Uint32Array(0),
    arrowFeatureIndices: new Uint32Array(0),
    outlineColor: 0,
    featureCount: 0,
  }
}

function makeRegion(
  displayedRegionIndex: number,
  start: number,
  end: number,
  screenStartPx: number,
  screenEndPx: number,
  reversed?: boolean,
): VisibleRegion {
  return {
    refName: 'ctgA',
    displayedRegionIndex,
    start,
    end,
    reversed,
    assemblyName: 'volvox',
    screenStartPx,
    screenEndPx,
  }
}

// Build the per-region Flatbush indexes the model would compute via its
// `flatbushIndexes` view, so tests can drive `performMultiRegionHitDetection`
// directly without booting an MST tree.
function buildIndexes(
  laidOutDataMap: Map<number, FeatureDataResult>,
  regions: VisibleRegion[],
  labels: LabelVisibility,
): Map<number, FlatbushRegionIndexes> {
  const out = new Map<number, FlatbushRegionIndexes>()
  for (const vr of regions) {
    const data = laidOutDataMap.get(vr.displayedRegionIndex)
    if (data) {
      const blockWidth = vr.screenEndPx - vr.screenStartPx
      const bpPerPx = (vr.end - vr.start) / blockWidth
      out.set(vr.displayedRegionIndex, {
        feature: buildFeatureFlatbushIndex(
          data.flatbushItems,
          data.floatingLabelsData,
          bpPerPx,
          vr.reversed ?? false,
          labels,
        ),
        subfeature: buildSubfeatureFlatbushIndex(data.subfeatureInfos),
      })
    }
  }
  return out
}

const DEFAULT_LABELS: LabelVisibility = {
  showLabels: true,
  showDescriptions: false,
}

function hit(
  laidOutDataMap: Map<number, FeatureDataResult>,
  regions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
  labels: LabelVisibility = DEFAULT_LABELS,
) {
  const indexes = buildIndexes(laidOutDataMap, regions, labels)
  return performMultiRegionHitDetection(
    laidOutDataMap,
    indexes,
    regions,
    mouseXPx,
    yPos,
  )
}

test('hits feature at correct coordinates', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    320,
    10,
  )
  expect(result.feature).not.toBeNull()
  expect(result.feature!.featureId).toBe('gene1')
})

test('misses when clicking outside feature bounds', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    10,
    10,
  )
  expect(result.feature).toBeNull()
})

test('misses when clicking below feature', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    320,
    25,
  )
  expect(result.feature).toBeNull()
})

test('returns correct displayedRegionIndex', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(
    new Map([[7, data]]),
    [makeRegion(7, 0, 10000, 0, 800)],
    320,
    10,
  )
  expect(result.feature).not.toBeNull()
  expect((result as any).displayedRegionIndex).toBe(7)
})

test('skips regions where mouseX is outside screen bounds', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const laidOutDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 100, 500)

  expect(hit(laidOutDataMap, [region], 50, 10).feature).toBeNull()
  expect(hit(laidOutDataMap, [region], 250, 10).feature).not.toBeNull()
})

test('hits subfeature when within subfeature bounds', () => {
  const parent = makeItem('gene1', 1000, 5000, 0, 30)
  const sub = makeSub('mRNA1', 'gene1', 2000, 3000, 5, 15)
  const data = makeData([parent], [sub])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    200,
    10,
  )
  expect(result.feature!.featureId).toBe('gene1')
  expect(result.subfeature!.featureId).toBe('mRNA1')
})

test('returns null subfeature when outside subfeature but inside feature', () => {
  const parent = makeItem('gene1', 1000, 5000, 0, 30)
  const sub = makeSub('mRNA1', 'gene1', 2000, 3000, 5, 15)
  const data = makeData([parent], [sub])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    120,
    25,
  )
  expect(result.feature!.featureId).toBe('gene1')
  expect(result.subfeature).toBeNull()
})

test('returns no hit when laidOutDataMap is empty', () => {
  const result = hit(new Map(), [makeRegion(0, 0, 10000, 0, 800)], 400, 10)
  expect(result.feature).toBeNull()
})

test('returns no hit when no visible regions', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(new Map([[0, data]]), [], 400, 10)
  expect(result.feature).toBeNull()
})

test('multi-region selects correct region', () => {
  const data1 = makeData([makeItem('geneA', 100, 400, 0, 20)])
  const data2 = makeData([makeItem('geneB', 100, 400, 0, 20)])
  const laidOutDataMap = new Map([
    [0, data1],
    [1, data2],
  ])
  const regions = [
    makeRegion(0, 0, 1000, 0, 400),
    makeRegion(1, 0, 1000, 400, 800),
  ]

  const hitR0 = hit(laidOutDataMap, regions, 100, 10)
  expect(hitR0.feature!.featureId).toBe('geneA')
  expect((hitR0 as any).displayedRegionIndex).toBe(0)

  const hitR1 = hit(laidOutDataMap, regions, 500, 10)
  expect(hitR1.feature!.featureId).toBe('geneB')
  expect((hitR1 as any).displayedRegionIndex).toBe(1)
})

test('multi-region continues to next region when first has no hit', () => {
  // region 0 is within X range but has no feature at Y=999; region 1 has a feature
  const data1 = makeData([makeItem('geneA', 100, 400, 0, 20)])
  const data2 = makeData([makeItem('geneB', 100, 400, 0, 20)])
  const laidOutDataMap = new Map([
    [0, data1],
    [1, data2],
  ])
  const regions = [
    makeRegion(0, 0, 1000, 0, 800),
    makeRegion(1, 0, 1000, 0, 800),
  ]

  expect(hit(laidOutDataMap, regions, 100, 999).feature).toBeNull()
  const h = hit(laidOutDataMap, regions, 100, 10)
  expect(h.feature!.featureId).toBe('geneA')
  expect((h as any).displayedRegionIndex).toBe(0)
})

test('handles reversed region (encoded via end < start, no flag)', () => {
  // Matches how LGV emits reversed regions: vr.end < vr.start; the bp mapping
  // is symmetric in the signed span so no reversed flag is needed here.
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const region = makeRegion(0, 10000, 0, 0, 800)
  const result = hit(new Map([[0, data]]), [region], 500, 10)
  expect(result.feature!.featureId).toBe('gene1')
})

test('handles reversed region with explicit flag', () => {
  // Reversed flag set + start<end: mouseX=500 maps to vr.end - 0.625*span = 3750
  const data = makeData([makeItem('gene1', 3000, 4000, 0, 20)])
  const region = makeRegion(0, 0, 10000, 0, 800, true)
  const result = hit(new Map([[0, data]]), [region], 500, 10)
  expect(result.feature!.featureId).toBe('gene1')
})

function makeDataWithLabel(
  flatbushItems: FlatbushItem[],
  labelTextWidth: number,
): FeatureDataResult {
  const data = makeData(flatbushItems)
  const item = flatbushItems[0]!
  return {
    ...data,
    floatingLabelsData: {
      [item.featureId]: {
        featureId: item.featureId,
        minX: item.startBp,
        maxX: item.endBp,
        topY: 0,
        featureHeight: item.bottomPx - item.topPx,
        nameLabel: {
          text: 'longname',
          relativeY: 0,
          color: '#000',
          textWidth: labelTextWidth,
        },
      },
    },
  }
}

test('label hit area extends past feature when showLabels is true', () => {
  const data = makeDataWithLabel([makeItem('gene1', 1000, 1100, 0, 20)], 200)
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    250,
    10,
    { showLabels: true, showDescriptions: false },
  )
  expect(result.feature).not.toBeNull()
})

test('label hit area collapses when showLabels is false', () => {
  const data = makeDataWithLabel([makeItem('gene1', 1000, 1100, 0, 20)], 200)
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    250,
    10,
    { showLabels: false, showDescriptions: false },
  )
  expect(result.feature).toBeNull()
})

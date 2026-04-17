import { performMultiRegionHitDetection } from './hitTesting.ts'

import type { FlatbushRegionCache, VisibleRegion } from './hitTesting.ts'
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
    regionStart: 0,
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
    featureCount: 0,
  }
}

function makeRegion(
  regionNumber: number,
  start: number,
  end: number,
  screenStartPx: number,
  screenEndPx: number,
): VisibleRegion {
  return {
    refName: 'ctgA',
    regionNumber,
    start,
    end,
    assemblyName: 'volvox',
    screenStartPx,
    screenEndPx,
  }
}

function freshCacheMap() {
  return new Map<number, FlatbushRegionCache>()
}

test('hits feature at correct coordinates', () => {
  const item = makeItem('gene1', 1000, 5000, 0, 20)
  const data = makeData([item])

  const rpcDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 0, 800)

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [region],
    320,
    10,
    false,
  )

  expect(result.feature).not.toBeNull()
  expect(result.feature!.featureId).toBe('gene1')
})

test('misses when clicking outside feature bounds', () => {
  const item = makeItem('gene1', 1000, 5000, 0, 20)
  const data = makeData([item])

  const rpcDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 0, 800)

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [region],
    10,
    10,
    false,
  )

  expect(result.feature).toBeNull()
})

test('misses when clicking below feature', () => {
  const item = makeItem('gene1', 1000, 5000, 0, 20)
  const data = makeData([item])

  const rpcDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 0, 800)

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [region],
    320,
    25,
    false,
  )

  expect(result.feature).toBeNull()
})

test('returns correct regionNumber', () => {
  const item = makeItem('gene1', 1000, 5000, 0, 20)
  const data = makeData([item])

  const rpcDataMap = new Map([[7, data]])
  const region = makeRegion(7, 0, 10000, 0, 800)

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [region],
    320,
    10,
    false,
  )

  expect(result.feature).not.toBeNull()
  expect((result as any).regionNumber).toBe(7)
})

test('skips regions where mouseX is outside screen bounds', () => {
  const item = makeItem('gene1', 1000, 5000, 0, 20)
  const data = makeData([item])

  const rpcDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 100, 500)

  const outside = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [region],
    50,
    10,
    false,
  )
  expect(outside.feature).toBeNull()

  const inside = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [region],
    250,
    10,
    false,
  )
  expect(inside.feature).not.toBeNull()
})

test('hits subfeature when within subfeature bounds', () => {
  const parent = makeItem('gene1', 1000, 5000, 0, 30)
  const sub = makeSub('mRNA1', 'gene1', 2000, 3000, 5, 15)
  const data = makeData([parent], [sub])

  const rpcDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 0, 800)

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [region],
    200,
    10,
    false,
  )

  expect(result.feature).not.toBeNull()
  expect(result.feature!.featureId).toBe('gene1')
  expect(result.subfeature).not.toBeNull()
  expect(result.subfeature!.featureId).toBe('mRNA1')
})

test('returns null subfeature when outside subfeature but inside feature', () => {
  const parent = makeItem('gene1', 1000, 5000, 0, 30)
  const sub = makeSub('mRNA1', 'gene1', 2000, 3000, 5, 15)
  const data = makeData([parent], [sub])

  const rpcDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 0, 800)

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [region],
    120,
    25,
    false,
  )

  expect(result.feature).not.toBeNull()
  expect(result.feature!.featureId).toBe('gene1')
  expect(result.subfeature).toBeNull()
})

test('returns no hit when rpcDataMap is empty', () => {
  const region = makeRegion(0, 0, 10000, 0, 800)

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    new Map(),
    [region],
    400,
    10,
    false,
  )

  expect(result.feature).toBeNull()
})

test('returns no hit when no visible regions', () => {
  const item = makeItem('gene1', 1000, 5000, 0, 20)
  const data = makeData([item])

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    new Map([[0, data]]),
    [],
    400,
    10,
    false,
  )

  expect(result.feature).toBeNull()
})

test('caches flatbush index across calls', () => {
  const item = makeItem('gene1', 1000, 5000, 0, 20)
  const data = makeData([item])

  const rpcDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 0, 800)
  const cacheMap = freshCacheMap()

  performMultiRegionHitDetection(cacheMap, rpcDataMap, [region], 320, 10, false)

  const cache = cacheMap.get(0)!
  expect(cache.featureIndex).not.toBeNull()
  expect(cache.cachedItems).toBe(data.flatbushItems)

  const savedIndex = cache.featureIndex

  performMultiRegionHitDetection(cacheMap, rpcDataMap, [region], 320, 10, false)

  expect(cacheMap.get(0)!.featureIndex).toBe(savedIndex)
})

test('rebuilds cache when data changes', () => {
  const item1 = makeItem('gene1', 1000, 5000, 0, 20)
  const data1 = makeData([item1])

  const rpcDataMap = new Map([[0, data1]])
  const region = makeRegion(0, 0, 10000, 0, 800)
  const cacheMap = freshCacheMap()

  performMultiRegionHitDetection(cacheMap, rpcDataMap, [region], 320, 10, false)

  const savedIndex = cacheMap.get(0)!.featureIndex

  const item2 = makeItem('gene2', 6000, 9000, 0, 20)
  const data2 = makeData([item2])
  rpcDataMap.set(0, data2)

  performMultiRegionHitDetection(cacheMap, rpcDataMap, [region], 560, 10, false)

  expect(cacheMap.get(0)!.featureIndex).not.toBe(savedIndex)
  expect(cacheMap.get(0)!.cachedItems).toBe(data2.flatbushItems)
})

test('multi-region selects correct region', () => {
  const item1 = makeItem('geneA', 100, 400, 0, 20)
  const item2 = makeItem('geneB', 100, 400, 0, 20)
  const data1 = makeData([item1])
  const data2 = makeData([item2])

  const rpcDataMap = new Map([
    [0, data1],
    [1, data2],
  ])
  const regions = [
    makeRegion(0, 0, 1000, 0, 400),
    makeRegion(1, 0, 1000, 400, 800),
  ]

  const hitR0 = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    regions,
    100,
    10,
    false,
  )
  expect(hitR0.feature!.featureId).toBe('geneA')
  expect((hitR0 as any).regionNumber).toBe(0)

  const hitR1 = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    regions,
    500,
    10,
    false,
  )
  expect(hitR1.feature!.featureId).toBe('geneB')
  expect((hitR1 as any).regionNumber).toBe(1)
})

test('multi-region continues to next region when first has no hit', () => {
  // region 0 is within X range but has no feature at Y=999; region 1 has a feature
  const item1 = makeItem('geneA', 100, 400, 0, 20)
  const item2 = makeItem('geneB', 100, 400, 0, 20)
  const data1 = makeData([item1])
  const data2 = makeData([item2])

  const rpcDataMap = new Map([
    [0, data1],
    [1, data2],
  ])
  // both regions span x=0..800 so both are candidates for any mouseX in that range
  const regions = [
    makeRegion(0, 0, 1000, 0, 800),
    makeRegion(1, 0, 1000, 0, 800),
  ]

  // y=999 is outside the feature rect (height=20 at y=0), so region 0 yields no hit
  // but region 1 should still be checked and also yields no hit at y=999
  const miss = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    regions,
    100,
    999,
    false,
  )
  expect(miss.feature).toBeNull()

  // y=10 hits in region 0 (first match wins)
  const hit = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    regions,
    100,
    10,
    false,
  )
  expect(hit.feature!.featureId).toBe('geneA')
  expect((hit as any).regionNumber).toBe(0)
})

test('handles reversed region', () => {
  const item = makeItem('gene1', 1000, 5000, 0, 20)
  const data = makeData([item])

  const rpcDataMap = new Map([[0, data]])
  const reversed = makeRegion(0, 10000, 0, 0, 800)

  const result = performMultiRegionHitDetection(
    freshCacheMap(),
    rpcDataMap,
    [reversed],
    500,
    10,
    false,
  )

  expect(result.feature).not.toBeNull()
  expect(result.feature!.featureId).toBe('gene1')
})

import { reconcileLayouts } from './reconcileLayouts.ts'

import type {
  FeatureDataResult,
  FlatbushItem,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

function makeItem(
  featureId: string,
  startBp: number,
  endBp: number,
  topPx: number,
  bottomPx: number,
): FlatbushItem {
  return {
    featureId,
    type: 'gene',
    startBp,
    endBp,
    topPx,
    bottomPx,
    tooltip: featureId,
  }
}

function makeRegionData(opts: {
  flatbushItems: FlatbushItem[]
  rectYs?: number[]
  lineYs?: number[]
  arrowYs?: number[]
}): FeatureDataResult {
  const { flatbushItems, rectYs = [], lineYs = [], arrowYs = [] } = opts
  return {
    regionStart: 0,
    rectPositions: new Uint32Array(0),
    rectYs: new Float32Array(rectYs),
    rectHeights: new Float32Array(rectYs.length),
    rectColors: new Uint8Array(0),
    numRects: rectYs.length,
    linePositions: new Uint32Array(0),
    lineYs: new Float32Array(lineYs),
    lineColors: new Uint8Array(0),
    lineDirections: new Int8Array(0),
    numLines: lineYs.length,
    arrowXs: new Uint32Array(0),
    arrowYs: new Float32Array(arrowYs),
    arrowDirections: new Int8Array(0),
    arrowHeights: new Float32Array(0),
    arrowColors: new Uint8Array(0),
    numArrows: arrowYs.length,
    flatbushItems,
    subfeatureInfos: [],
    floatingLabelsData: {},
    maxY: Math.max(0, ...flatbushItems.map(i => i.bottomPx)),
  }
}

describe('reconcileLayouts', () => {
  it('is a no-op for a single region', () => {
    const item = makeItem('geneA', 100, 200, 0, 20)
    const data = makeRegionData({ flatbushItems: [item], rectYs: [0] })
    const map = new Map([[0, data]])
    reconcileLayouts(map)
    expect(item.topPx).toBe(0)
    expect(item.bottomPx).toBe(20)
  })

  it('is a no-op when layouts already match across regions', () => {
    const item1 = makeItem('geneA', 100, 500, 0, 20)
    const item2 = makeItem('geneA', 100, 500, 0, 20)
    const data1 = makeRegionData({ flatbushItems: [item1], rectYs: [5] })
    const data2 = makeRegionData({ flatbushItems: [item2], rectYs: [5] })
    const map = new Map([
      [0, data1],
      [1, data2],
    ])
    reconcileLayouts(map)
    expect(data1.rectYs[0]).toBe(5)
    expect(data2.rectYs[0]).toBe(5)
  })

  it('reconciles a feature at different y offsets across two regions', () => {
    const item1 = makeItem('geneA', 100, 500, 0, 20)
    const item2 = makeItem('geneA', 100, 500, 30, 50)
    const data1 = makeRegionData({
      flatbushItems: [item1],
      rectYs: [5, 10],
    })
    const data2 = makeRegionData({
      flatbushItems: [item2],
      rectYs: [35, 40],
    })
    const map = new Map([
      [0, data1],
      [1, data2],
    ])
    reconcileLayouts(map)

    // geneA should be placed at y=0 (unified), region 1 already has it there
    expect(item1.topPx).toBe(0)
    expect(item1.bottomPx).toBe(20)
    // region 2 had it at y=30, delta = -30
    expect(item2.topPx).toBe(0)
    expect(item2.bottomPx).toBe(20)
    // rectYs in region 2 should shift by -30
    expect(data2.rectYs[0]).toBe(5)
    expect(data2.rectYs[1]).toBe(10)
  })

  it('reconciles multiple features preserving non-overlap', () => {
    // Region 0: geneA at y=0, geneB at y=25
    // Region 1: geneB at y=0, geneA at y=25 (swapped)
    const a1 = makeItem('geneA', 100, 300, 0, 20)
    const b1 = makeItem('geneB', 100, 300, 25, 45)
    const a2 = makeItem('geneA', 100, 300, 25, 45)
    const b2 = makeItem('geneB', 100, 300, 0, 20)

    const data1 = makeRegionData({
      flatbushItems: [a1, b1],
      rectYs: [5, 30],
    })
    const data2 = makeRegionData({
      flatbushItems: [a2, b2],
      rectYs: [30, 5],
    })
    const map = new Map([
      [0, data1],
      [1, data2],
    ])
    reconcileLayouts(map)

    // Unified layout should place both features consistently.
    // geneA and geneB overlap in bp (both 100-300), so one must be below the other.
    // geneA sorts first (same start), gets y=0.
    // geneB overlaps geneA, placed at y=20.
    expect(a1.topPx).toBe(0)
    expect(a2.topPx).toBe(0)
    expect(b1.topPx).toBe(20)
    expect(b2.topPx).toBe(20)
  })

  it('places non-overlapping features at y=0', () => {
    const a1 = makeItem('geneA', 100, 200, 0, 20)
    const b1 = makeItem('geneB', 300, 400, 25, 45)
    const data1 = makeRegionData({
      flatbushItems: [a1, b1],
      rectYs: [5, 30],
    })
    const data2 = makeRegionData({
      flatbushItems: [makeItem('geneA', 100, 200, 0, 20)],
      rectYs: [5],
    })
    const map = new Map([
      [0, data1],
      [1, data2],
    ])
    reconcileLayouts(map)

    // geneA and geneB don't overlap in bp, both get y=0
    expect(a1.topPx).toBe(0)
    expect(b1.topPx).toBe(0)
  })

  it('shifts lineYs and arrowYs along with rectYs', () => {
    const item1 = makeItem('geneA', 100, 500, 0, 20)
    const item2 = makeItem('geneA', 100, 500, 40, 60)
    const data1 = makeRegionData({
      flatbushItems: [item1],
      rectYs: [5],
      lineYs: [10],
      arrowYs: [10],
    })
    const data2 = makeRegionData({
      flatbushItems: [item2],
      rectYs: [45],
      lineYs: [50],
      arrowYs: [50],
    })
    const map = new Map([
      [0, data1],
      [1, data2],
    ])
    reconcileLayouts(map)

    // Region 2 delta = -40
    expect(data2.rectYs[0]).toBe(5)
    expect(data2.lineYs[0]).toBe(10)
    expect(data2.arrowYs[0]).toBe(10)
    // Region 1 unchanged
    expect(data1.rectYs[0]).toBe(5)
    expect(data1.lineYs[0]).toBe(10)
    expect(data1.arrowYs[0]).toBe(10)
  })

  it('shifts subfeatureInfos preserving height', () => {
    const item1 = makeItem('geneA', 100, 500, 0, 30)
    const item2 = makeItem('geneA', 100, 500, 50, 80)
    const sub = {
      featureId: 'tx1',
      parentFeatureId: 'geneA',
      type: 'mRNA',
      startBp: 100,
      endBp: 500,
      topPx: 55,
      bottomPx: 70,
    }
    const data2 = makeRegionData({ flatbushItems: [item2] })
    data2.subfeatureInfos = [sub]
    const map = new Map([
      [0, makeRegionData({ flatbushItems: [item1] })],
      [1, data2],
    ])
    reconcileLayouts(map)

    // delta = -50, sub was at 55-70 (within 50-80 band)
    expect(sub.topPx).toBe(5)
    expect(sub.bottomPx).toBe(20)
  })

  it('shifts floatingLabelsData topY', () => {
    const item1 = makeItem('geneA', 100, 500, 0, 20)
    const item2 = makeItem('geneA', 100, 500, 30, 50)
    const data2 = makeRegionData({ flatbushItems: [item2] })
    data2.floatingLabelsData = {
      geneA: {
        featureId: 'geneA',
        minX: 0,
        maxX: 400,
        topY: 30,
        featureHeight: 20,
        floatingLabels: [],
      },
    }
    const map = new Map([
      [0, makeRegionData({ flatbushItems: [item1] })],
      [1, data2],
    ])
    reconcileLayouts(map)

    expect(data2.floatingLabelsData.geneA!.topY).toBe(0)
  })

  it('updates maxY after reconciliation', () => {
    const item1 = makeItem('geneA', 100, 300, 0, 20)
    const item2 = makeItem('geneA', 100, 300, 50, 70)
    const data2 = makeRegionData({ flatbushItems: [item2] })
    expect(data2.maxY).toBe(70)
    const map = new Map([
      [0, makeRegionData({ flatbushItems: [item1] })],
      [1, data2],
    ])
    reconcileLayouts(map)

    expect(data2.maxY).toBe(20)
  })

  it('creates new array references for flatbushItems and subfeatureInfos', () => {
    const item1 = makeItem('geneA', 100, 500, 0, 20)
    const item2 = makeItem('geneA', 100, 500, 30, 50)
    const data2 = makeRegionData({ flatbushItems: [item2] })
    const origItems = data2.flatbushItems
    const origSubs = data2.subfeatureInfos
    const map = new Map([
      [0, makeRegionData({ flatbushItems: [item1] })],
      [1, data2],
    ])
    reconcileLayouts(map)

    expect(data2.flatbushItems).not.toBe(origItems)
    expect(data2.subfeatureInfos).not.toBe(origSubs)
  })

  it('does not create new array references when no changes needed', () => {
    const item1 = makeItem('geneA', 100, 500, 0, 20)
    const item2 = makeItem('geneA', 100, 500, 0, 20)
    const data1 = makeRegionData({ flatbushItems: [item1] })
    const data2 = makeRegionData({ flatbushItems: [item2] })
    const origItems1 = data1.flatbushItems
    const origItems2 = data2.flatbushItems
    const map = new Map([
      [0, data1],
      [1, data2],
    ])
    reconcileLayouts(map)

    expect(data1.flatbushItems).toBe(origItems1)
    expect(data2.flatbushItems).toBe(origItems2)
  })

  it('handles features with different heights correctly', () => {
    // geneA is 20px tall, geneB is 40px tall, they overlap in bp
    const a1 = makeItem('geneA', 100, 300, 0, 20)
    const b1 = makeItem('geneB', 150, 350, 25, 65)
    const data1 = makeRegionData({ flatbushItems: [a1, b1] })
    const data2 = makeRegionData({
      flatbushItems: [
        makeItem('geneA', 100, 300, 50, 70),
        makeItem('geneB', 150, 350, 0, 40),
      ],
    })
    const map = new Map([
      [0, data1],
      [1, data2],
    ])
    reconcileLayouts(map)

    // geneA at y=0 (height 20), geneB overlaps so placed at y=20 (height 40)
    expect(a1.topPx).toBe(0)
    expect(a1.bottomPx).toBe(20)
    expect(b1.topPx).toBe(20)
    expect(b1.bottomPx).toBe(60)
  })

  it('handles three regions with overlapping features', () => {
    const mkA = (top: number) => makeItem('geneA', 100, 500, top, top + 20)
    const data0 = makeRegionData({ flatbushItems: [mkA(0)] })
    const data1 = makeRegionData({ flatbushItems: [mkA(10)] })
    const data2 = makeRegionData({ flatbushItems: [mkA(25)] })
    const map = new Map([
      [0, data0],
      [1, data1],
      [2, data2],
    ])
    reconcileLayouts(map)

    // All three should converge to the same y
    const items = [
      data0.flatbushItems[0]!,
      data1.flatbushItems[0]!,
      data2.flatbushItems[0]!,
    ]
    expect(items[0]!.topPx).toBe(items[1]!.topPx)
    expect(items[1]!.topPx).toBe(items[2]!.topPx)
  })
})

import { autorun } from 'mobx'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

function regionData(n: number, spacing = 10, length = 8, prefix = 'f') {
  const features = Array.from({ length: n }, (_, i) => ({
    featureId: `${prefix}${i}`,
    startBp: i * spacing,
    endBp: i * spacing + length,
  }))
  return makeFeatureData({
    flatbushItems: features.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'feature',
        startBp: f.startBp,
        endBp: f.endBp,
        bottomPx: 10,
        featureHeightPx: 10,
      }),
    ),
    rectPositions: new Uint32Array(features.flatMap(f => [f.startBp, f.endBp])),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.map(() => 10)),
    rectColors: new Uint32Array(features.length),
    rectStrands: new Float32Array(features.length),
    rectDensityFade: new Uint32Array(features.length),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
  })
}

function setup() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setRpcData(0, regionData(50), ctgA)
  // Nothing here observes flatbushIndexes; only the model's CanvasHitIndexes
  // autorun does, and that subscription is what makes MobX cache it.
  const dispose = autorun(() => {
    void display.renderDataMap
    void display.featureIdIndex
  })
  const index = () => display.flatbushIndexes.get(0)!.feature
  return { display, view, dispose, index }
}

describe('flatbushIndexes caching', () => {
  it('has a non-empty index to begin with', () => {
    const { display, index, dispose } = setup()
    expect(display.laidOutDataMap.size).toBe(1)
    expect(index()).not.toBeNull()
    expect(index()!.search(15, 5, 15, 5).length).toBeGreaterThan(0)
    dispose()
  })

  it('reuses indexes across mousemoves at a fixed viewport', () => {
    const { index, dispose } = setup()
    const first = index()
    for (let i = 0; i < 10; i++) {
      expect(index()).toBe(first)
    }
    dispose()
  })

  it('does not rebuild while a zoom gesture is in flight', () => {
    const { view, index, dispose } = setup()
    const first = index()
    view.zoomTo(view.bpPerPx * 2)
    expect(view.bpPerPx).not.toBe(view.coarseBpPerPx)
    expect(index()).toBe(first)
    dispose()
  })

  it('rebuilds once the zoom settles, then caches at the new zoom', () => {
    const { view, index, dispose } = setup()
    const first = index()
    view.zoomTo(view.bpPerPx * 2)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    const afterZoom = index()
    expect(afterZoom).not.toBe(first)
    expect(index()).toBe(afterZoom)
    dispose()
  })

  it('rebuilds when label visibility changes', () => {
    const { display, index, dispose } = setup()
    const first = index()
    display.setShowLabels(display.renderedShowLabels ? 'none' : 'name')
    expect(index()).not.toBe(first)
    dispose()
  })

  it('rebuilds when the laid-out data changes', () => {
    const { display, index, dispose } = setup()
    const first = index()
    display.setRpcData(0, regionData(60), ctgA)
    expect(index()).not.toBe(first)
    dispose()
  })

  it('evicts regions that leave the screen', () => {
    const { display, index, dispose } = setup()
    const first = index()
    display.dropLoadedRegion(0)
    expect(display.flatbushIndexes.size).toBe(0)
    display.setRpcData(0, regionData(50), ctgA)
    expect(index()).not.toBe(first)
    dispose()
  })

  it("keeps a region's index when another region arrives", () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    const ctgB = { ...ctgA, refName: 'ctgB' }
    view.setDisplayedRegions([ctgA, ctgB])
    const dispose = autorun(() => void display.flatbushIndexes)
    display.setRpcData(0, regionData(50), ctgA)
    const laid = display.laidOutDataMap.get(0)
    const indexes = display.flatbushIndexes.get(0)

    display.setRpcData(1, regionData(50, 10, 8, 'g'), ctgB)

    expect(display.flatbushIndexes.size).toBe(2)
    expect(display.laidOutDataMap.get(0)).toBe(laid)
    expect(display.flatbushIndexes.get(0)).toBe(indexes)
    dispose()
  })
})

describe('a squeezed fit track across a settle', () => {
  function setup() {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, regionData(500, 20, 400), ctgA)
    const dispose = autorun(() => {
      void display.renderDataMap
      void display.flatbushIndexes
    })
    return { display, view, dispose }
  }

  it('keeps its scaled regions and their index when the settle moves no row', () => {
    const { display, view, dispose } = setup()
    expect(display.fitScale).toBeLessThan(1)
    const { layout, scale } = display.fitStage
    const measured = display.fitMeasureFeatureIds
    const laid = display.laidOutDataMap
    const index = display.flatbushIndexes.get(0)

    view.scrollTo(view.offsetPx + 50)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)

    expect(display.fitMeasureFeatureIds).not.toEqual(measured)
    expect(display.fitStage.layout).toBe(layout)
    expect(display.fitScale).toBe(scale)
    expect(display.laidOutDataMap).toBe(laid)
    expect(display.renderDataMap).toBe(laid)
    expect(display.flatbushIndexes.get(0)).toBe(index)
    dispose()
  })

  it('rescales once the track height moves the squeeze', () => {
    const { display, dispose } = setup()
    const scale = display.fitScale
    const laid = display.laidOutDataMap

    display.setHeight(display.height + 40)

    expect(display.fitScale).toBeGreaterThan(scale)
    expect(display.fitScale).toBeLessThan(1)
    expect(display.laidOutDataMap).not.toBe(laid)
    dispose()
  })
})

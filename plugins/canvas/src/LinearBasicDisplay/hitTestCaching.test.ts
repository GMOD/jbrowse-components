import { autorun } from 'mobx'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

// Reference identity, not a spy: a reused index IS the same object, a rebuilt one
// is a fresh Flatbush. Exact, and no mocking needed.
function regionData(n: number) {
  const features = Array.from({ length: n }, (_, i) => ({
    featureId: `f${i}`,
    startBp: i * 10,
    endBp: i * 10 + 8,
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
  display.setRpcData(0, regionData(50), view.bpPerPx, {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 10_000,
  })
  // Mimic the real component: the overlay layers observe renderDataMap /
  // featureItemMap during render. Nothing here observes flatbushIndexes — only
  // the model's own CanvasHitIndexes autorun does, and that subscription is
  // exactly what makes MobX cache it (an unobserved computed is suspended and
  // re-evaluates on every read).
  const dispose = autorun(() => {
    void display.renderDataMap
    void display.featureItemMap
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

  // Regression: hit-testing reads this view only from mouse handlers, so without
  // the CanvasHitIndexes autorun it has no observer, MobX suspends it, and every
  // mousemove rebuilt a Flatbush (Hilbert sort + tree build) per region.
  it('reuses indexes across mousemoves at a fixed viewport', () => {
    const { index, dispose } = setup()
    const first = index()
    for (let i = 0; i < 10; i++) {
      expect(index()).toBe(first)
    }
    dispose()
  })

  // Keyed on coarseBpPerPx (the settled zoom the layout packs rows at), so an
  // in-flight zoom gesture does not rebuild every index each frame.
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
    display.setShowLabels(display.renderedShowLabels ? 'off' : 'on')
    expect(index()).not.toBe(first)
    dispose()
  })

  it('rebuilds when the laid-out data changes', () => {
    const { display, view, index, dispose } = setup()
    const first = index()
    display.setRpcData(0, regionData(60), view.bpPerPx, {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 10_000,
    })
    expect(index()).not.toBe(first)
    dispose()
  })

  it('evicts regions that leave the screen', () => {
    const { display, index, dispose } = setup()
    const first = index()
    display.pruneRpcDataMapToVisible(new Set())
    expect(display.flatbushIndexes.size).toBe(0)
    display.setRpcData(0, regionData(50), 1, {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 10_000,
    })
    expect(index()).not.toBe(first)
    dispose()
  })
})

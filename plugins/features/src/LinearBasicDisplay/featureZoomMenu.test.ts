import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  clickContextMenuItem,
  createTestEnvironment,
  rightClick,
} from './testEnv.ts'

import type { TestDisplay } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

const splitRegions = [
  { assemblyName: 'volvox', start: 1000, end: 2000, refName: 'ctgA' },
  { assemblyName: 'volvox', start: 8000, end: 9100, refName: 'ctgA' },
]

function loadGene(display: TestDisplay) {
  display.setRpcData(0, makeFeatureData({ flatbushItems: [gene] }), ctgA)
}

describe('feature "Zoom to feature" context menu', () => {
  it('frames the whole feature with flanks when the region contains it', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    loadGene(display)

    rightClick(display, gene)
    clickContextMenuItem(display, 'Zoom to feature')

    const [vr] = view.visibleRegions
    expect(vr!.start).toBeLessThan(1050)
    expect(vr!.end).toBeGreaterThan(9000)
  })

  it('clamps to the displayed region when the feature outgrows it', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions(splitRegions)
    loadGene(display)

    rightClick(display, gene)
    expect(() => {
      clickContextMenuItem(display, 'Zoom to feature')
    }).not.toThrow()

    expect(
      view.visibleRegions.map(
        (vr: { displayedRegionIndex: number }) => vr.displayedRegionIndex,
      ),
    ).toEqual([0])
    const [vr] = view.visibleRegions
    expect(Math.round(vr!.start)).toBe(1000)
    expect(Math.round(vr!.end)).toBe(2000)
  })

  it('zooms to the base a zero-length feature is painted at', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    const insertion = makeFlatbushItem({
      featureId: 'ins',
      type: 'insertion',
      name: 'ins',
      startBp: 4000,
      endBp: 4000,
    })
    display.setRpcData(0, makeFeatureData({ flatbushItems: [insertion] }), ctgA)

    rightClick(display, insertion)
    clickContextMenuItem(display, 'Zoom to feature')

    const [vr] = view.visibleRegions
    expect(vr!.start).toBeLessThanOrEqual(4000)
    expect(vr!.end).toBeGreaterThanOrEqual(4001)
  })

  it('clamps to the clicked region, not the first sharing its refName', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions(splitRegions)
    loadGene(display)

    display.openContextMenu({
      item: gene,
      displayedRegionIndex: 1,
      clientX: 0,
      clientY: 0,
    })
    clickContextMenuItem(display, 'Zoom to feature')

    const vr = view.visibleRegions.find(
      (r: { displayedRegionIndex: number }) => r.displayedRegionIndex === 1,
    )
    expect(Math.round(vr!.start)).toBe(8000)
    expect(Math.round(vr!.end)).toBe(9100)
  })
})

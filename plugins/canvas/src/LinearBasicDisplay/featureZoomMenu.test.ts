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

// volvox's EDEN locus, 1050..9000 — wider than either exon block below
const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

// A collapsed-introns view's shape: the gene's exons as separate displayed
// regions on one refName, so the gene's own span is inside NEITHER of them.
// This display's "Collapse introns" builds exactly this.
const splitRegions = [
  { assemblyName: 'volvox', start: 1000, end: 2000, refName: 'ctgA' },
  { assemblyName: 'volvox', start: 8000, end: 9100, refName: 'ctgA' },
]

function loadGene(display: TestDisplay) {
  display.setRpcData(0, makeFeatureData({ flatbushItems: [gene] }), ctgA)
  display.setLoadedRegion(0, ctgA)
}

describe('feature "Zoom to feature" context menu', () => {
  it('frames the whole feature with flanks when the region contains it', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    loadGene(display)

    rightClick(display, gene)
    clickContextMenuItem(display, 'Zoom to feature')

    // 1050..9000 grown ~20% each side and clamped to the region: the gene is
    // framed, not pinned to the viewport edges
    const [vr] = view.visibleRegions
    expect(vr!.start).toBeLessThan(1050)
    expect(vr!.end).toBeGreaterThan(9000)
  })

  // `navTo` takes a span wholly inside ONE displayed region and THROWS
  // otherwise, so before the clamp this raised `could not find a region that
  // contained "ctgA:1,051..9,000"` out of a menu item's onClick — no
  // navigation, nothing said, and the error escaping the React handler.
  it('clamps to the displayed region when the feature outgrows it', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions(splitRegions)
    loadGene(display)

    rightClick(display, gene)
    expect(() => {
      clickContextMenuItem(display, 'Zoom to feature')
    }).not.toThrow()

    // zoomed to the part of the gene the clicked block shows (1050..2000, grown
    // and clamped back to the block), rather than nowhere at all
    expect(
      view.visibleRegions.map(
        (vr: { displayedRegionIndex: number }) => vr.displayedRegionIndex,
      ),
    ).toEqual([0])
    const [vr] = view.visibleRegions
    expect(Math.round(vr!.start)).toBe(1000)
    expect(Math.round(vr!.end)).toBe(2000)
  })

  it('clamps to the clicked region, not the first sharing its refName', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions(splitRegions)
    loadGene(display)

    // the same gene as drawn in the SECOND exon block
    display.openContextMenu({
      item: gene,
      displayedRegionIndex: 1,
      clientX: 0,
      clientY: 0,
    })
    clickContextMenuItem(display, 'Zoom to feature')

    // the second block, filling the viewport (region 0 trails behind as a
    // zero-width edge block). Clamping to region 0 instead would have zoomed
    // 6kb away from where the click landed.
    const vr = view.visibleRegions.find(
      (r: { displayedRegionIndex: number }) => r.displayedRegionIndex === 1,
    )
    expect(Math.round(vr!.start)).toBe(8000)
    expect(Math.round(vr!.end)).toBe(9100)
  })
})

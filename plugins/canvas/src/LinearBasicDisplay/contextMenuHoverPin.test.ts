import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment, rightClick } from './testEnv.ts'

function regionData() {
  const features = Array.from({ length: 4 }, (_, i) => ({
    featureId: `f${i}`,
    startBp: i * 100,
    endBp: i * 100 + 80,
  }))
  return makeFeatureData({
    flatbushItems: features.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'gene',
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
  const { display } = createDisplay()
  display.setRpcData(0, regionData(), {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 10_000,
  })
  const items = display.laidOutDataMap.get(0)!.flatbushItems
  return { display, menuTarget: items[0]!, other: items[2]! }
}

// The highlight box is derived from the open menu's target rather than pinned
// into the hover: the box the user sees and the thing the menu names are one
// value, so no hover source can re-point one without the other. Same rule as
// the multi-row display's `highlightedBlockRect`.
describe('the highlight box follows the context menu target', () => {
  it('boxes the right-clicked feature', () => {
    const { display, menuTarget } = setup()
    rightClick(display, menuTarget)
    expect(display.contextMenuInfo!.item.featureId).toBe(menuTarget.featureId)
    expect(display.hoverBoxFeature?.featureId).toBe(menuTarget.featureId)
  })

  it('drops the hover and its tooltip when the menu opens', () => {
    const { display, menuTarget, other } = setup()
    display.setHover(other.featureId, null, [other.tooltip])

    rightClick(display, menuTarget)

    expect(display.hoveredFeature).toBeNull()
    expect(display.mouseoverExtraInformation).toBeUndefined()
  })

  it('keeps boxing the target whatever the hover does while the menu is open', () => {
    const { display, menuTarget, other } = setup()
    rightClick(display, menuTarget)

    display.setHover(other.featureId, null, [other.tooltip])
    expect(display.hoverBoxFeature?.featureId).toBe(menuTarget.featureId)

    display.clearHover()
    expect(display.hoverBoxFeature?.featureId).toBe(menuTarget.featureId)
  })

  it('follows the hover again once the menu closes', () => {
    const { display, menuTarget, other } = setup()
    rightClick(display, menuTarget)
    display.closeContextMenu()
    expect(display.hoverBoxFeature).toBeNull()

    display.setHover(other.featureId, null, [other.tooltip])
    expect(display.hoverBoxFeature?.featureId).toBe(other.featureId)
    expect(display.mouseoverExtraInformation).toEqual([other.tooltip])
  })
})

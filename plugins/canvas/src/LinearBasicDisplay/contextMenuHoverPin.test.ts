import { createTestEnvironment } from './testEnv.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

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
  const { display, view } = createDisplay()
  display.setRpcData(0, regionData(), view.bpPerPx, {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 10_000,
  })
  const items = display.laidOutDataMap.get(0)!.flatbushItems
  return { display, menuTarget: items[0]!, other: items[2]! }
}

describe('context menu hover pin', () => {
  it('pins the hover box to the right-clicked feature', () => {
    const { display, menuTarget } = setup()
    display.openContextMenu(menuTarget, 0, 100, 100)
    expect(display.contextMenuInfo!.item.featureId).toBe(menuTarget.featureId)
    expect(display.featureIdUnderMouse).toBe(menuTarget.featureId)
  })

  // Regression: the label layer emits mousemove over its own label divs with no
  // knowledge of the open menu, so it called setHover for whatever label the
  // cursor drifted onto — re-pointing the highlight box at a feature the menu
  // would not act on. setHover itself now holds the pin.
  it('ignores a hover from any source while the menu is open', () => {
    const { display, menuTarget, other } = setup()
    display.openContextMenu(menuTarget, 0, 100, 100)

    display.setHover(other.featureId, null, other.tooltip)

    expect(display.featureIdUnderMouse).toBe(menuTarget.featureId)
    expect(display.subfeatureIdUnderMouse).toBeNull()
    expect(display.mouseoverExtraInformation).toBeUndefined()
  })

  it('releases the pin when the menu closes', () => {
    const { display, menuTarget, other } = setup()
    display.openContextMenu(menuTarget, 0, 100, 100)
    display.closeContextMenu()
    expect(display.featureIdUnderMouse).toBeNull()

    display.setHover(other.featureId, null, other.tooltip)
    expect(display.featureIdUnderMouse).toBe(other.featureId)
    expect(display.mouseoverExtraInformation).toBe(other.tooltip)
  })

  it('hovers normally when no menu is open', () => {
    const { display, other } = setup()
    display.setHover(other.featureId, null, other.tooltip)
    expect(display.featureIdUnderMouse).toBe(other.featureId)
  })
})

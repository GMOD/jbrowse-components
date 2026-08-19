import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  clickContextMenuItem,
  createTestEnvironment,
  rightClick,
} from './testEnv.ts'

import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { TestDisplay } from './testEnv.ts'

// Which right-click actions are allowed to MOVE the clicked feature, and what
// has to follow when one does. "Pin to top" is the one that moves it, and the
// viewport has to come along; "Highlight" marks it and must leave the layout
// alone. Both failed the same way — the feature the user just acted on ended up
// somewhere they could not see it.

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

// `rows` fully-overlapping features, so the packer stacks them one per row and a
// feature's row index is unambiguous.
function stackedData(rows: number) {
  const flatbushItems = Array.from({ length: rows }, (_, i) =>
    makeFlatbushItem({
      featureId: `f${i}`,
      type: 'feature',
      name: `f${i}`,
      startBp: 100,
      endBp: 900,
      bottomPx: 10,
      featureHeightPx: 10,
    }),
  )
  return makeFeatureData({
    flatbushItems,
    rectPositions: new Uint32Array(flatbushItems.flatMap(() => [100, 900])),
    rectYs: new Float32Array(rows),
    rectHeights: new Float32Array(rows).fill(10),
    rectColors: new Uint32Array(rows),
    rectStrands: new Float32Array(rows),
    rectDensityFade: new Uint32Array(rows),
    rectFeatureIndices: new Uint32Array(flatbushItems.map((_, i) => i)),
  })
}

function topOf(display: TestDisplay, featureId: string) {
  const items: FlatbushItem[] = display.laidOutDataMap.get(0)!.flatbushItems
  return items.find(i => i.featureId === featureId)!.topPx
}

// A track deeper than its 100px viewport, scrolled down to the bottom feature.
function scrolledStack() {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay({ heightMode: 'scroll', height: 100 })
  const data = stackedData(40)
  display.setRpcData(0, data, ctgA)
  display.setLoadedRegion(0, ctgA)
  const deepest = data.flatbushItems.at(-1)!
  display.setScrollTop(topOf(display, deepest.featureId))
  return { display, deepest }
}

describe('right-click actions that move a row', () => {
  it('has something out of view to act on', () => {
    const { display, deepest } = scrolledStack()
    expect(display.hasOverflow).toBe(true)
    // row 0 is far above the viewport, so anything sent there needs the scroll
    // to follow it
    expect(topOf(display, deepest.featureId)).toBeGreaterThan(display.height)
  })

  it('"Highlight feature" boxes without moving the feature', () => {
    const { display, deepest } = scrolledStack()
    const before = topOf(display, deepest.featureId)

    rightClick(display, deepest)
    clickContextMenuItem(display, 'Highlight feature')

    // the box is drawn where the user is looking, not after yanking the feature
    // to row 0 (which reshuffled every other row too)
    expect([...display.highlightedFeatureIdSet]).toEqual([deepest.featureId])
    expect(topOf(display, deepest.featureId)).toBe(before)
    expect(display.scrollTop).toBeGreaterThan(0)
  })

  it('"Pin to top" brings the viewport with the feature', () => {
    const { display, deepest } = scrolledStack()

    rightClick(display, deepest)
    clickContextMenuItem(display, 'Pin to top')

    // row 0, and in view — pinning without the scroll reset sent the feature to
    // topPx 0 while the viewport stayed at 780, so it vanished upward
    expect(topOf(display, deepest.featureId)).toBe(0)
    expect(display.scrollTop).toBe(0)
  })

  it('"Unpin from top" leaves the scroll where the user put it', () => {
    const { display, deepest } = scrolledStack()

    rightClick(display, deepest)
    clickContextMenuItem(display, 'Pin to top')
    display.setScrollTop(200)
    clickContextMenuItem(display, 'Unpin from top')

    // unpinning returns the feature to its natural row; it is not a request to
    // look at anything, so it must not yank the viewport
    expect(display.pinnedFeatureCount).toBe(0)
    expect(display.scrollTop).toBe(200)
  })

  it('leaves the searched-highlight pin alone', () => {
    // a text-search highlight carries no featureId and names a feature the user
    // cannot see, so it still earns the pin that surfaces it
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      featureHighlights: [{ refName: 'ctgA', start: 100, end: 900 }],
    })
    display.setRpcData(0, stackedData(3), ctgA)
    display.setLoadedRegion(0, ctgA)

    expect([...display.layoutPinnedFeatureIdSet].sort()).toEqual([
      'f0',
      'f1',
      'f2',
    ])
  })
})

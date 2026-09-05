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

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

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

function scrolledStack() {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay({ heightMode: 'scroll', height: 100 })
  const data = stackedData(40)
  display.setRpcData(0, data, ctgA)
  const deepest = data.flatbushItems.at(-1)!
  display.setScrollTop(topOf(display, deepest.featureId))
  return { display, deepest }
}

describe('right-click actions that move a row', () => {
  it('has something out of view to act on', () => {
    const { display, deepest } = scrolledStack()
    expect(display.hasOverflow).toBe(true)
    expect(topOf(display, deepest.featureId)).toBeGreaterThan(display.height)
  })

  it('"Highlight feature" boxes without moving the feature', () => {
    const { display, deepest } = scrolledStack()
    const before = topOf(display, deepest.featureId)

    rightClick(display, deepest)
    clickContextMenuItem(display, 'Highlight feature')

    expect([...display.highlightedFeatureIdSet]).toEqual([deepest.featureId])
    expect(topOf(display, deepest.featureId)).toBe(before)
    expect(display.scrollTop).toBeGreaterThan(0)
  })

  it('"Pin to top" brings the viewport with the feature', () => {
    const { display, deepest } = scrolledStack()

    rightClick(display, deepest)
    clickContextMenuItem(display, 'Pin to top')

    expect(topOf(display, deepest.featureId)).toBe(0)
    expect(display.scrollTop).toBe(0)
  })

  it('"Unpin from top" leaves the scroll where the user put it', () => {
    const { display, deepest } = scrolledStack()

    rightClick(display, deepest)
    clickContextMenuItem(display, 'Pin to top')
    display.setScrollTop(200)
    clickContextMenuItem(display, 'Unpin from top')

    expect(display.pinnedFeatureCount).toBe(0)
    expect(display.scrollTop).toBe(200)
  })

  it('leaves the searched-highlight pin alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      featureHighlights: [{ refName: 'ctgA', start: 100, end: 900 }],
    })
    display.setRpcData(0, stackedData(3), ctgA)

    expect([...display.layoutPinnedFeatureIdSet].sort()).toEqual([
      'f0',
      'f1',
      'f2',
    ])
  })
})

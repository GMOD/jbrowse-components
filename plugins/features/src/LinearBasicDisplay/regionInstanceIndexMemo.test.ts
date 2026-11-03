import { LITERAL } from '../RenderFeatureDataRPC/colorClasses.ts'
import { packRenderArrays } from '../RenderFeatureDataRPC/packRenderArrays.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type * as FeatureHighlightInk from './featureHighlightInk.ts'

const mockBuilt = { count: 0 }

jest.mock('./featureHighlightInk.ts', () => {
  const actual = jest.requireActual<typeof FeatureHighlightInk>(
    './featureHighlightInk.ts',
  )
  return {
    ...actual,
    buildRegionInstanceIndex: (
      ...args: Parameters<typeof actual.buildRegionInstanceIndex>
    ) => {
      mockBuilt.count++
      return actual.buildRegionInstanceIndex(...args)
    },
  }
})

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }
const ctgB = { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 10_000 }

function regionData(featureId: string) {
  return makeFeatureData({
    ...packRenderArrays(
      [
        {
          start: 100,
          end: 200,
          y: 0,
          height: 10,
          strand: 0,
          flatbushIdx: 0,
          labelRowsAbove: 0,
          colorClass: LITERAL,
          color: 0xff_80_40_ff,
        },
      ],
      [],
      [],
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    flatbushItems: [makeFlatbushItem({ featureId })],
    featureCount: 1,
  })
}

function setup() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setHeightMode('fixed')
  view.zoomTo(10)
  view.scrollTo(0)
  mockBuilt.count = 0
  return { display, view }
}

test('a second pass over unchanged regions builds nothing', () => {
  const { display } = setup()
  display.setRpcData(0, regionData('a'), ctgA)
  display.setRpcData(1, regionData('b'), ctgB)
  const first = display.regionInstanceIndexes
  const second = display.regionInstanceIndexes
  expect(mockBuilt.count).toBe(2)
  expect(second.get(0)).toBe(first.get(0))
  expect(second.get(1)).toBe(first.get(1))
})

test('a region arriving builds only that region', () => {
  const { display } = setup()
  display.setRpcData(0, regionData('a'), ctgA)
  const before = display.regionInstanceIndexes
  mockBuilt.count = 0
  display.setRpcData(1, regionData('b'), ctgB)
  const after = display.regionInstanceIndexes
  expect(mockBuilt.count).toBe(1)
  expect(after.get(0)).toBe(before.get(0))
})

test('a region replaced by new data is rebuilt', () => {
  const { display } = setup()
  display.setRpcData(0, regionData('a'), ctgA)
  const first = display.regionInstanceIndexes
  display.setRpcData(0, regionData('a'), ctgA)
  const second = display.regionInstanceIndexes
  expect(mockBuilt.count).toBe(2)
  expect(second.get(0)).not.toBe(first.get(0))
})

test("the display's indexes survive MobX dropping the unobserved computed", () => {
  const { display, view } = setup()
  display.setRpcData(0, regionData('a'), ctgA)
  view.settleCoarseBlocks()
  const first = display.regionInstanceIndexes.get(0)
  expect(first).toBeDefined()
  expect(display.regionInstanceIndexes.get(0)).toBe(first)
  expect(mockBuilt.count).toBe(1)
})

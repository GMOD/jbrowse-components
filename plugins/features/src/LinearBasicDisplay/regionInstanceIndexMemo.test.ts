import { LITERAL } from '../RenderFeatureDataRPC/colorClasses.ts'
import { packRenderArrays } from '../RenderFeatureDataRPC/packRenderArrays.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  buildRegionInstanceIndex,
  createRegionInstanceIndexMemo,
} from './featureHighlightInk.ts'
import { createTestEnvironment } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

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

test('a second pass over unchanged regions builds nothing', () => {
  const build = jest.fn(buildRegionInstanceIndex)
  const indexesOf = createRegionInstanceIndexMemo(build)
  const regions = new Map([
    [0, regionData('a')],
    [1, regionData('b')],
  ])
  const first = indexesOf(regions)
  const second = indexesOf(regions)
  expect(build).toHaveBeenCalledTimes(2)
  expect(second.get(0)).toBe(first.get(0))
  expect(second.get(1)).toBe(first.get(1))
})

test('a region arriving builds only that region', () => {
  const build = jest.fn(buildRegionInstanceIndex)
  const indexesOf = createRegionInstanceIndexMemo(build)
  const a = regionData('a')
  const before = indexesOf(new Map([[0, a]]))
  build.mockClear()
  const after = indexesOf(
    new Map([
      [0, a],
      [1, regionData('b')],
    ]),
  )
  expect(build).toHaveBeenCalledTimes(1)
  expect(after.get(0)).toBe(before.get(0))
})

test('a region replaced by new data is rebuilt', () => {
  const build = jest.fn(buildRegionInstanceIndex)
  const indexesOf = createRegionInstanceIndexMemo(build)
  const first = indexesOf(new Map([[0, regionData('a')]]))
  const second = indexesOf(new Map([[0, regionData('a')]]))
  expect(build).toHaveBeenCalledTimes(2)
  expect(second.get(0)).not.toBe(first.get(0))
})

test("the display's indexes survive MobX dropping the unobserved computed", () => {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setHeightMode('fixed')
  view.zoomTo(10)
  view.scrollTo(0)
  display.setRpcData(0, regionData('a'), ctgA)
  view.settleCoarseBlocks()
  const first = display.regionInstanceIndexes.get(0)
  expect(first).toBeDefined()
  expect(display.regionInstanceIndexes.get(0)).toBe(first)
})

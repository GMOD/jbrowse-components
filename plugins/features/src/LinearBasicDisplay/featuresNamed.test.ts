import { LITERAL } from '../RenderFeatureDataRPC/colorClasses.ts'
import { packRenderArrays } from '../RenderFeatureDataRPC/packRenderArrays.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { RectData } from '../RenderFeatureDataRPC/packRenderArrays.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

function rect(
  over: Partial<RectData> & Pick<RectData, 'start' | 'end' | 'y' | 'height'>,
): RectData {
  return {
    color: 0xff_80_40_ff,
    colorClass: LITERAL,
    strand: 0,
    flatbushIdx: 0,
    labelRowsAbove: 0,
    ...over,
  }
}

// A named two-row gene at bp 1000-2000, and at 3000-3200 a record with no
// name, only the description a VCF record with no ID carries.
function data() {
  return makeFeatureData({
    ...packRenderArrays(
      [
        rect({ start: 1000, end: 1500, y: 0, height: 10 }),
        rect({ start: 1600, end: 2000, y: 15, height: 10 }),
        rect({ start: 3000, end: 3200, y: 0, height: 10, flatbushIdx: 1 }),
      ],
      [],
      [],
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    flatbushItems: [
      makeFlatbushItem({
        featureId: 'g1',
        startBp: 1000,
        endBp: 2000,
        topPx: 0,
        bottomPx: 25,
        featureHeightPx: 25,
        name: 'GENE1',
      }),
      makeFlatbushItem({
        featureId: 'v1',
        startBp: 3000,
        endBp: 3200,
        topPx: 0,
        bottomPx: 10,
        featureHeightPx: 10,
        description: 'C -> T',
      }),
    ],
    featureCount: 2,
  })
}

// bpPerPx 10 from bp 0, so bp 1000 lands on px 100
function setUp() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setHeightMode('fixed')
  view.zoomTo(10)
  view.scrollTo(0)
  display.setRpcData(0, data(), ctgA)
  view.settleCoarseBlocks()
  return { display, view }
}

test('a name finds the body its feature drew, without its label', () => {
  const { display } = setUp()
  expect(display.featuresNamed('GENE1')).toEqual([
    {
      featureId: 'g1',
      text: 'GENE1',
      left: 100,
      top: 0,
      width: 100,
      height: 25,
    },
  ])
})

test('a record with no name is found by its description', () => {
  const { display } = setUp()
  expect(display.featuresNamed('C -> T')).toEqual([
    expect.objectContaining({ featureId: 'v1', left: 300, width: 20 }),
  ])
})

test('a name nothing drew finds nothing', () => {
  const { display } = setUp()
  expect(display.featuresNamed('GENE2')).toEqual([])
})

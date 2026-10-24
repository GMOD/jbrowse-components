import {
  makeFeatureData,
  makeFlatbushItem,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { colorValuesInSpans, onScreenColorValues } from './derivedColorKey.ts'

// One gene with two parts, SH2 at 100-200 and Torsin at 900-1000, each
// carrying its own value.
function twoParts() {
  return makeFeatureData({
    ...packFixtureRects([
      { startBp: 100, endBp: 200 },
      { startBp: 900, endBp: 1000 },
    ]),
    rectColorValues: Uint32Array.from([1, 2]),
    rectFeatureIndices: Uint32Array.from([0, 0]),
    flatbushItems: [makeFlatbushItem({ featureId: 'gene' })],
    colorValues: {
      field: 'name',
      values: ['SH2', 'Torsin'],
      painted: [
        { rowIndex: 0, valueIndex: 0 },
        { rowIndex: 0, valueIndex: 1 },
      ],
      rows: [{ strand: undefined, groupKey: undefined }],
    },
  })
}

function paintedNames(data: ReturnType<typeof twoParts>) {
  const { values, painted } = data.colorValues!
  return painted.map(p => values[p.valueIndex])
}

test('a part off screen names nothing though its feature is on screen', () => {
  const data = twoParts()
  expect(paintedNames(onScreenColorValues(data, new Set(['gene'])))).toEqual([
    'SH2',
    'Torsin',
  ])
  expect(
    paintedNames(colorValuesInSpans(data, [{ start: 0, end: 500 }])),
  ).toEqual(['SH2'])
})

test('a span touching no part names nothing, and the values stay whole', () => {
  const narrowed = colorValuesInSpans(twoParts(), [{ start: 300, end: 800 }])
  expect(paintedNames(narrowed)).toEqual([])
  expect(narrowed.colorValues?.values).toEqual(['SH2', 'Torsin'])
})

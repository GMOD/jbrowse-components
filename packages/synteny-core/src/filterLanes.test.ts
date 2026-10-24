import { comparativeFilter, unreadFilterFields } from './filterLanes.ts'

import type { ColorFunctionInputs } from './colorFunctions.ts'

const data: ColorFunctionInputs = {
  strands: Int8Array.from([1, -1]),
  refNameDict: ['chr1', 'chr2'],
  refNameIds: Uint32Array.from([0, 1]),
  mateRefNameDict: ['ctgA'],
  mateRefNameIds: Uint32Array.from([0, 0]),
  attributes: { identity: Float32Array.from([0.95, 0.5]) },
  attributeRanges: { identity: { min: 0.5, max: 0.95 } },
}

const admitted = (
  filter: Parameters<typeof comparativeFilter>[0],
  extras?: Parameters<typeof comparativeFilter>[2],
) => {
  const test = comparativeFilter(filter, data, extras)
  return [0, 1].filter(i => test?.(i) ?? true)
}

test('reference reads the lane the view anchors this level on', () => {
  const filter = [{ field: 'reference', oneOf: ['chr2'] }]
  expect(admitted(filter)).toEqual([1])
  expect(admitted(filter, { referenceSide: 'target' })).toEqual([])
  expect(
    admitted([{ field: 'reference', equal: 'ctgA' }], {
      referenceSide: 'target',
    }),
  ).toEqual([0, 1])
})

test('a field the payload has no lane for is named, a jexl: entry included', () => {
  expect(
    unreadFilterFields(
      [
        { field: 'pident', gte: 90 },
        { field: 'identity', gte: 0.9 },
        { field: 'jexl:feature.x > 1', equal: true },
        { field: 'dnds', valid: false },
        { field: 'reference', oneOf: ['chr1'] },
      ],
      data,
    ),
  ).toEqual(['pident', 'jexl:feature.x > 1'])
})

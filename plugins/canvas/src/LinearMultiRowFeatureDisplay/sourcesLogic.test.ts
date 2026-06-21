import { orderPartitionValues } from './sourcesLogic.ts'

test('empty rowOrder = sorted', () => {
  expect(orderPartitionValues(new Set(['c', 'a', 'b']), [])).toEqual([
    'a',
    'b',
    'c',
  ])
})

test('rowOrder values come first in order, rest sorted', () => {
  expect(
    orderPartitionValues(new Set(['c', 'a', 'b', 'd']), ['d', 'b']),
  ).toEqual(['d', 'b', 'a', 'c'])
})

test('rowOrder entries not present in data are skipped', () => {
  expect(orderPartitionValues(new Set(['a', 'b']), ['z', 'b'])).toEqual([
    'b',
    'a',
  ])
})

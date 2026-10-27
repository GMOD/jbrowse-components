import { displayDefaultSlots } from './displayDefaultKeys.ts'
import { liftToSnapshot, mergeBySlots } from './liftConfig.ts'

import type { SlotEntry } from './types.ts'

const filter: SlotEntry = {
  name: 'filter',
  type: 'Predicates',
  subSlots: [
    { name: 'expressions', type: 'array' },
    { name: 'minScore', type: 'number' },
  ],
  shorthand: { list: 'expressions' },
}

const rules: SlotEntry = {
  name: 'rules',
  type: 'array',
  subSlots: [{ name: 'value', type: 'number' }],
  shorthand: { number: 'value' },
}

test('a list lifts into the slot its shorthand names', () => {
  expect(
    liftToSnapshot({ filter: ['jexl:feature.score > 1'] }, [filter]),
  ).toEqual({ filter: { expressions: ['jexl:feature.score > 1'] } })
})

test('a list of sub-schemas still lifts entry by entry', () => {
  expect(liftToSnapshot({ rules: [5, { value: 7 }] }, [rules])).toEqual({
    rules: [{ value: 5 }, { value: 7 }],
  })
})

describe('mergeBySlots, over the slots a track type writes', () => {
  const wiggle = displayDefaultSlots('QuantitativeTrack')
  const feature = displayDefaultSlots('FeatureTrack')

  test('a bare name merges into the members the other bag writes', () => {
    expect(
      mergeBySlots(
        { mark: { type: 'bar', extent: 'none' } },
        { mark: 'line' },
        wiggle,
      ),
    ).toEqual({ mark: { type: 'line', extent: 'none' } })
  })

  test('a channel takes the later bag whole', () => {
    expect(
      mergeBySlots(
        { encoding: { color: { value: 'red' } }, height: 50 },
        { encoding: { color: { field: 'strand' } } },
        feature,
      ),
    ).toEqual({ encoding: { color: { field: 'strand' } }, height: 50 })
  })

  test('a value merged with nothing keeps its spelling', () => {
    expect(mergeBySlots({ height: 50 }, { mark: 'line' }, wiggle)).toEqual({
      height: 50,
      mark: 'line',
    })
  })

  test("a plugin track's keys merge as plain JSON", () => {
    expect(
      mergeBySlots({ thing: { a: 1, b: 2 } }, { thing: { b: 3 } }),
    ).toEqual({ thing: { a: 1, b: 3 } })
  })
})

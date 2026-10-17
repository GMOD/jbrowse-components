import { liftToSnapshot } from './liftConfig.ts'

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

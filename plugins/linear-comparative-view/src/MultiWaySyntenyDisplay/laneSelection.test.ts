import {
  lanesInForce,
  pickedLanes,
  withLaneHidden,
  withLaneShown,
} from './laneSelection.ts'

// a lowercase spelling stands in for an assembly alias
const keyOf = (name: string) => name.toLowerCase()

test('the lanes in force are rows.kept, else the configured lanes, else every lane', () => {
  expect(lanesInForce([], [])).toBeUndefined()
  expect(lanesInForce([], ['c'])).toEqual(['c'])
  expect(lanesInForce(['a'], ['c'])).toEqual(['a'])
})

test('a hide appends to the hidden lanes once, by key', () => {
  expect(withLaneHidden([], 'a', keyOf)).toEqual(['a'])
  const once = withLaneHidden(['a'], 'A', keyOf)
  expect(once).toEqual(['a'])
})

test('a show unhides, and joins the lanes in force where they leave it out', () => {
  expect(
    withLaneShown({ kept: [], hidden: ['a'], configured: [] }, 'A', keyOf),
  ).toEqual({ kept: [], hidden: [] })
  expect(
    withLaneShown(
      { kept: ['a', 'b'], hidden: ['a'], configured: [] },
      'a',
      keyOf,
    ),
  ).toEqual({ kept: ['a', 'b'], hidden: [] })
  expect(
    withLaneShown({ kept: ['b'], hidden: [], configured: [] }, 'a', keyOf),
  ).toEqual({ kept: ['b', 'a'], hidden: [] })
  // the configured lanes are the choice in force when none is written
  expect(
    withLaneShown({ kept: [], hidden: [], configured: ['b'] }, 'a', keyOf),
  ).toEqual({ kept: ['b', 'a'], hidden: [] })
  expect(
    withLaneShown({ kept: [], hidden: [], configured: [] }, 'a', keyOf),
  ).toEqual({ kept: [], hidden: [] })
})

describe('the picker submit', () => {
  test('every offered lane ticked is no choice', () => {
    expect(
      pickedLanes(
        {
          picked: ['a', 'B'],
          offered: ['A', 'b'],
          inForce: undefined,
          configured: [],
        },
        keyOf,
      ),
    ).toBeUndefined()
    expect(
      pickedLanes(
        {
          picked: ['a'],
          offered: ['a', 'b'],
          inForce: undefined,
          configured: [],
        },
        keyOf,
      ),
    ).toEqual(['a'])
  })

  test('the configured lanes are the choice a declaring track comes back to', () => {
    expect(
      pickedLanes(
        {
          picked: ['a', 'b'],
          offered: ['a', 'b', 'c'],
          inForce: ['a', 'b'],
          configured: ['a', 'b'],
        },
        keyOf,
      ),
    ).toBeUndefined()
  })

  test('a lane in force but outside the window stays chosen', () => {
    expect(
      pickedLanes(
        {
          picked: ['a'],
          offered: ['a', 'b'],
          inForce: ['a', 'z'],
          configured: [],
        },
        keyOf,
      ),
    ).toEqual(['a', 'z'])
  })
})

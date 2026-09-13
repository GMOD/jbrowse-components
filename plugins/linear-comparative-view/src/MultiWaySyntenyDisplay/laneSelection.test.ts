import {
  hiddenLanesOf,
  laneFilterOf,
  lanesInForce,
  pickedLanes,
  withLaneHidden,
  withLaneShown,
} from './laneSelection.ts'

// the display keys through the assembly manager; here a lowercase spelling
// stands in for an alias
const keyOf = (name: string) => name.toLowerCase()

test('a filter that says nothing is undefined, and an empty except drops out', () => {
  expect(laneFilterOf(undefined, [])).toBeUndefined()
  expect(laneFilterOf(['a'], [])).toEqual({ only: ['a'] })
  expect(laneFilterOf(undefined, ['b'])).toEqual({ except: ['b'] })
  expect(laneFilterOf([], [])).toEqual({ only: [] })
})

test('the lanes in force are the choice, else the configured lanes, else every lane', () => {
  expect(lanesInForce(undefined, [])).toBeUndefined()
  expect(lanesInForce(undefined, ['c'])).toEqual(['c'])
  expect(lanesInForce({ only: ['a'] }, ['c'])).toEqual(['a'])
  expect(lanesInForce({ except: ['a'] }, ['c'])).toEqual(['c'])
})

// a choice in force is also what a declaring adapter fetches, so a hide
// leaves it alone and only takes the lane out of the drawing
test('a hide appends to except under any choice and never rewrites it', () => {
  expect(withLaneHidden(undefined, 'a', keyOf)).toEqual({ except: ['a'] })
  expect(withLaneHidden({ only: ['a', 'b'] }, 'a', keyOf)).toEqual({
    only: ['a', 'b'],
    except: ['a'],
  })
  const twice = withLaneHidden({ except: ['a'] }, 'A', keyOf)
  expect(twice).toEqual({ except: ['a'] })
  expect(hiddenLanesOf(twice)).toEqual(['a'])
})

test('a show unhides, and joins the lanes in force where they leave it out', () => {
  expect(withLaneShown({ except: ['a'] }, [], 'A', keyOf)).toBeUndefined()
  expect(
    withLaneShown({ only: ['a', 'b'], except: ['a'] }, [], 'a', keyOf),
  ).toEqual({ only: ['a', 'b'] })
  expect(withLaneShown({ only: ['b'] }, [], 'a', keyOf)).toEqual({
    only: ['b', 'a'],
  })
  // the configured lanes are the choice in force when none is written
  expect(withLaneShown(undefined, ['b'], 'a', keyOf)).toEqual({
    only: ['b', 'a'],
  })
  expect(withLaneShown(undefined, [], 'a', keyOf)).toBeUndefined()
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
          picked: ['a'],
          offered: ['a', 'b'],
          inForce: ['a'],
          configured: ['a'],
        },
        keyOf,
      ),
    ).toBeUndefined()
    expect(
      pickedLanes(
        {
          picked: ['a', 'b'],
          offered: ['a', 'b'],
          inForce: ['a'],
          configured: ['a'],
        },
        keyOf,
      ),
    ).toEqual(['a', 'b'])
  })

  test('a lane in force that this window did not offer survives the pick', () => {
    expect(
      pickedLanes(
        {
          picked: ['a'],
          offered: ['a', 'b'],
          inForce: ['a', 'far'],
          configured: [],
        },
        keyOf,
      ),
    ).toEqual(['a', 'far'])
  })
})

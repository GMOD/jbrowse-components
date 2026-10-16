import {
  laneUniverseOf,
  lanesInForce,
  pickedLanes,
  withLaneHidden,
  withLaneShown,
} from './laneSelection.ts'

import type { LaneUniverseInputs } from './laneSelection.ts'

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

describe('laneUniverseOf', () => {
  const universe = (overrides: Partial<LaneUniverseInputs> = {}) =>
    laneUniverseOf({
      anchor: 'hg38',
      mateNames: [],
      declared: [],
      trackAssemblies: [],
      keyOf,
      labelOf: name => name,
      selection: undefined,
      hidden: [],
      featuresLoaded: true,
      landedLanes: undefined,
      ...overrides,
    })

  test('the anchor is never a lane, whatever its spelling', () => {
    expect(
      universe({ declared: [{ name: 'HG38' }, { name: 'mm10' }] }).map(
        l => l.name,
      ),
    ).toEqual(['mm10'])
  })

  test('declared lanes come first, then the track’s, then mates, each once', () => {
    expect(
      universe({
        declared: [{ name: 'a' }],
        trackAssemblies: ['B', 'a'],
        mateNames: ['c', 'b'],
      }).map(l => l.name),
    ).toEqual(['a', 'B', 'c'])
  })

  test('a lane is placed when a mate names it, and unplaced when the fetch asked and found none', () => {
    const lanes = universe({
      declared: [{ name: 'a' }, { name: 'b' }],
      mateNames: ['a'],
      landedLanes: ['a', 'b'],
    })
    expect(lanes.map(l => l.placed)).toEqual([true, false])
  })

  test('a lane the fetch did not ask for has no placed answer', () => {
    const lanes = universe({
      declared: [{ name: 'a' }, { name: 'b' }],
      landedLanes: ['a'],
    })
    expect(lanes.map(l => l.placed)).toEqual([false, undefined])
  })

  test('before any features land no lane has a placed answer', () => {
    expect(
      universe({ declared: [{ name: 'a' }], featuresLoaded: false })[0]!.placed,
    ).toBeUndefined()
  })

  test('a lane is drawn when selected and not hidden', () => {
    const lanes = universe({
      declared: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      selection: ['A', 'b'],
      hidden: ['B'],
    })
    expect(lanes.map(l => [l.name, l.drawn])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ])
  })

  test('a shown name replaces the declared label only where it differs from the name', () => {
    const [lane] = universe({
      declared: [{ name: 'a', label: 'Declared' }],
      labelOf: () => 'Display name',
    })
    expect(lane!.label).toBe('Display name')
    const [kept] = universe({ declared: [{ name: 'a', label: 'Declared' }] })
    expect(kept!.label).toBe('Declared')
  })
})

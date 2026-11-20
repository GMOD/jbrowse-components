import { SimpleFeature } from '@jbrowse/core/util'

import { fileUnderCopies } from './copyLane.ts'
import {
  anchorRowOf,
  laneColorOf,
  laneLabelOf,
  laneOrderOf,
  laneRowsOf,
  laneUniverseOf,
  lanesInForce,
  pickedLanes,
  withLaneHidden,
  withLaneShown,
} from './laneSelection.ts'
import { groupFeatures } from './layoutMultiWay.ts'

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

test("a lane's color is its pin, else its source's, else none, through any spelling", () => {
  const colorOf = (name: string) =>
    laneColorOf(name, {
      pinned: new Map([['hg002#1', 'red']]),
      declared: new Map([
        ['hg002#1', 'blue'],
        ['hg002#2', 'green'],
        ['chm13', 'black'],
      ]),
      keyOf,
    })
  expect(colorOf('HG002#1')).toBe('red')
  expect(colorOf('HG002#2')).toBe('green')
  expect(colorOf('CHM13')).toBe('black')
  expect(colorOf('HG003#1')).toBeUndefined()
})

describe('copy lanes', () => {
  const groups = fileUnderCopies(
    groupFeatures(
      ['chr11', 'chr9', 'chr11', 'chrG3'].map(
        (refName, i) =>
          new SimpleFeature({
            uniqueId: `r${i}`,
            refName: 'chrG7',
            start: i * 100,
            end: i * 100 + 50,
            name: `g${i}`,
            mate: {
              assemblyName: refName === 'chrG3' ? 'peach' : 'grape',
              refName,
              start: i * 100,
              end: i * 100 + 50,
            },
          }),
      ),
    ),
  )
  const rowsOf = (opts: Partial<Parameters<typeof laneRowsOf>[0]>) =>
    laneRowsOf({
      groups,
      placeless: [],
      anchor: 'peach',
      preferred: [],
      selection: undefined,
      hidden: [],
      keyOf,
      ...opts,
    })

  test('a copy on the anchor’s own genome draws no lane', () => {
    expect(rowsOf({})).toEqual(['{grape}chr11', '{grape}chr9'])
  })

  test('a genome named in rows.kept, rows.sort or the hidden lanes reaches each copy', () => {
    expect(rowsOf({ selection: ['Grape'] })).toEqual([
      '{grape}chr11',
      '{grape}chr9',
    ])
    expect(rowsOf({ hidden: ['grape'] })).toEqual([])
    expect(rowsOf({ selection: ['{grape}chr9'] })).toEqual(['{grape}chr9'])
    expect(rowsOf({ preferred: ['{GRAPE}chr9', 'grape'] })).toEqual([
      '{grape}chr9',
      '{grape}chr11',
    ])
  })

  test('the anchor stacks after the lanes rows.sort names before it', () => {
    const rows = ['{grape}chr9', '{grape}chr11', 'cacao']
    expect(anchorRowOf([], rows, 'peach', keyOf)).toBe(0)
    expect(anchorRowOf(['{grape}chr9', 'Peach'], rows, 'peach', keyOf)).toBe(1)
    expect(anchorRowOf(['grape', 'peach'], rows, 'peach', keyOf)).toBe(2)
    expect(anchorRowOf(['gone', 'peach'], rows, 'peach', keyOf)).toBe(0)
    // a lane placing nothing sits at the foot, below the anchor
    expect(
      anchorRowOf(
        ['{grape}chr9', 'peach', '{grape}chr11'],
        ['{grape}chr11', '{grape}chr9'],
        'peach',
        keyOf,
      ),
    ).toBe(0)
    expect(laneOrderOf(rows, 'peach', 1)).toEqual([
      '{grape}chr9',
      'peach',
      '{grape}chr11',
      'cacao',
    ])
  })

  test('a copy lane takes its own label, else its genome’s and its contig', () => {
    const labelOf = (name: string) =>
      laneLabelOf(name, {
        written: new Map([
          ['grape', 'Vitis'],
          ['{grape}chr4', 'older copy'],
        ]),
        heldName: () => undefined,
        declared: new Map(),
        keyOf,
        shownRefName: (_assemblyName, refName) => refName.toUpperCase(),
      })
    expect(labelOf('{grape}chr4')).toBe('older copy')
    expect(labelOf('{Grape}chr9')).toBe('Vitis CHR9')
    expect(labelOf('{cacao}tc1')).toBe('cacao TC1')
  })

  test('a copy lane takes its genome’s color where it has none of its own', () => {
    const colorOf = (name: string) =>
      laneColorOf(name, {
        pinned: new Map([
          ['grape', 'red'],
          ['{grape}chr4', 'blue'],
        ]),
        declared: new Map(),
        keyOf,
      })
    expect(colorOf('{grape}chr4')).toBe('blue')
    expect(colorOf('{grape}chr9')).toBe('red')
    expect(colorOf('{cacao}tc1')).toBeUndefined()
  })
})

import { SimpleFeature } from '@jbrowse/core/util'

import { fileUnderCopies, fileUnderPieces, lanesPlacedIn } from './copyLane.ts'
import { laneOrderAfterDrop, sortAfterDrop } from './laneDrag.ts'
import {
  anchorRowOf,
  laneColorOf,
  laneLabelOf,
  laneOrderOf,
  laneRowsOf,
  laneUniverseOf,
  lanesInForce,
  noLanesPlacedText,
  pickedLanes,
  unalignedChosenLanesOf,
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
  const lanes = ['a', 'b']
  expect(
    withLaneShown(
      { kept: [], hidden: ['a'], configured: [], lanes },
      'A',
      keyOf,
    ),
  ).toEqual({ kept: [], hidden: [] })
  expect(
    withLaneShown(
      { kept: ['a', 'b'], hidden: ['a'], configured: [], lanes },
      'a',
      keyOf,
    ),
  ).toEqual({ kept: ['a', 'b'], hidden: [] })
  expect(
    withLaneShown(
      { kept: ['b'], hidden: [], configured: [], lanes },
      'a',
      keyOf,
    ),
  ).toEqual({ kept: ['b', 'a'], hidden: [] })
  // the configured lanes are the choice in force when none is written
  expect(
    withLaneShown(
      { kept: [], hidden: [], configured: ['b'], lanes },
      'a',
      keyOf,
    ),
  ).toEqual({ kept: ['b', 'a'], hidden: [] })
  expect(
    withLaneShown({ kept: [], hidden: [], configured: [], lanes }, 'a', keyOf),
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
  const { groups } = fileUnderCopies(
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

  test('another contig of the anchor’s genome draws a lane, which the anchor’s sort entry leaves unplaced', () => {
    expect(rowsOf({})).toEqual(['{grape}chr11', '{grape}chr9', '{peach}chrG3'])
    expect(rowsOf({ preferred: ['peach', '{grape}chr9'] })).toEqual([
      '{grape}chr9',
      '{grape}chr11',
      '{peach}chrG3',
    ])
  })

  test('a genome named in rows.kept or the hidden lanes reaches each copy', () => {
    expect(rowsOf({ selection: ['Grape'] })).toEqual([
      '{grape}chr11',
      '{grape}chr9',
    ])
    expect(rowsOf({ hidden: ['grape'] })).toEqual(['{peach}chrG3'])
    expect(rowsOf({ selection: ['{grape}chr9'] })).toEqual(['{grape}chr9'])
  })

  test('a genome kept beside one of its copies keeps only the copies named', () => {
    expect(rowsOf({ selection: ['grape', '{grape}chr9'] })).toEqual([
      '{grape}chr9',
    ])
  })

  test('rows.sort entries place lanes in the order written, a genome filling only its copies named nowhere else', () => {
    expect(rowsOf({ preferred: ['{GRAPE}chr9', 'grape'] }).slice(0, 2)).toEqual(
      ['{grape}chr9', '{grape}chr11'],
    )
    expect(rowsOf({ preferred: ['grape', '{grape}chr9'] }).slice(0, 2)).toEqual(
      ['{grape}chr11', '{grape}chr9'],
    )
    expect(
      rowsOf({ preferred: ['grape', '{grape}chr9', '{grape}chr11'] }).slice(
        0,
        2,
      ),
    ).toEqual(['{grape}chr9', '{grape}chr11'])
  })

  test('the anchor stacks after the lanes rows.sort places before it, copy lanes only', () => {
    const rows = ['{grape}chr9', '{grape}chr11', 'cacao']
    const rowOf = (sort: string[], field: 'refName' | 'assembly' = 'refName') =>
      anchorRowOf({ field, sort, rows, anchor: 'peach', keyOf })
    expect(rowOf([])).toBe(0)
    expect(rowOf(['{grape}chr9', 'Peach'])).toBe(1)
    expect(rowOf(['grape', 'peach'])).toBe(2)
    expect(rowOf(['gone', 'peach'])).toBe(0)
    // a genome before the anchor fills only its copies named nowhere else
    expect(rowOf(['grape', 'peach', '{grape}chr11'])).toBe(1)
    expect(rowOf(['{grape}chr9', 'peach'], 'assembly')).toBe(0)
    // a lane placing nothing sits at the foot, below the anchor
    expect(
      anchorRowOf({
        field: 'refName',
        sort: ['{grape}chr9', 'peach', '{grape}chr11'],
        rows: ['{grape}chr11', '{grape}chr9'],
        anchor: 'peach',
        keyOf,
      }),
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

describe('switching rows.field', () => {
  const row = (name: string, i: number, assemblyName: string, ref: string) =>
    new SimpleFeature({
      uniqueId: `${name}-${assemblyName}-${ref}`,
      refName: 'chrG7',
      start: i * 200,
      end: i * 200 + 100,
      name,
      mate: { assemblyName, refName: ref, start: i * 200, end: i * 200 + 50 },
    })
  const genes = Array.from({ length: 10 }, (_, i) => `g${i}`)
  const grouped = groupFeatures([
    ...genes.map((n, i) => row(n, i, 'grape', 'chr11')),
    ...genes.slice(0, 5).map((n, i) => row(n, i, 'grape', 'chr9')),
    ...genes.map((n, i) => row(n, i, 'cacao', 'tc1')),
  ])
  const kept = ['{grape}chr9', '{grape}chr11']
  const rowsUnder = (copies: boolean, selection: string[], sort: string[]) => {
    const groups = copies ? fileUnderCopies(grouped).groups : grouped
    return laneRowsOf({
      groups,
      placeless: unalignedChosenLanesOf(
        selection,
        groups,
        () => true,
        keyOf,
        copies ? 'refName' : 'assembly',
      ),
      anchor: 'peach',
      preferred: sort,
      selection: selection.length ? selection : undefined,
      hidden: [],
      keyOf,
    })
  }

  test('copy lanes kept give back their genome lane, with no placeless lanes', () => {
    expect(rowsUnder(false, kept, [])).toEqual(['grape'])
    expect(rowsUnder(true, kept, [])).toEqual(['{grape}chr11', '{grape}chr9'])
  })

  test('a genome kept keeps each of its copies, and a kept copy placing nothing stands for its genome', () => {
    expect(rowsUnder(true, ['grape'], [])).toEqual([
      '{grape}chr11',
      '{grape}chr9',
    ])
    const noGrape = grouped.map(g => ({
      ...g,
      mates: new Map([...g.mates].filter(([name]) => name !== 'grape')),
    }))
    expect(
      unalignedChosenLanesOf(kept, noGrape, () => true, keyOf, 'assembly'),
    ).toEqual(['grape'])
    expect(
      unalignedChosenLanesOf(kept, noGrape, () => true, keyOf, 'refName'),
    ).toEqual(kept)
  })

  test('a sort written for copy lanes orders genome lanes', () => {
    expect(rowsUnder(false, [], ['cacao'])).toEqual(['cacao', 'grape'])
    expect(rowsUnder(false, [], ['{grape}chr9', 'peach', 'cacao'])).toEqual([
      'grape',
      'cacao',
    ])
  })

  test('a copy lane drags where rows.sort already names its genome', () => {
    const orderUnder = (sort: string[]) => {
      const rows = rowsUnder(true, [], sort)
      return laneOrderOf(
        rows,
        'peach',
        anchorRowOf({ field: 'refName', sort, rows, anchor: 'peach', keyOf }),
      )
    }
    const sort = ['grape']
    const order = orderUnder(sort)
    expect(order).toEqual([
      'peach',
      '{grape}chr11',
      '{grape}chr9',
      '{cacao}tc1',
    ])
    const written = sortAfterDrop(
      sort,
      laneOrderAfterDrop(order, '{grape}chr9', 1, 'peach')!,
      'peach',
      keyOf,
    )
    expect(orderUnder(written)).toEqual([
      'peach',
      '{grape}chr9',
      '{grape}chr11',
      '{cacao}tc1',
    ])
  })
})

describe('the lane dialog with copy lanes', () => {
  const universe = laneUniverseOf({
    anchor: 'peach',
    mateNames: ['{grape}chr11'],
    declared: [],
    trackAssemblies: ['grape', 'peach'],
    keyOf,
    labelOf: name => name,
    selection: undefined,
    hidden: [],
    featuresLoaded: true,
    landedLanes: undefined,
    underFloor: ['{grape}chr4'],
  })

  test('lists a genome as placed where its copies draw', () => {
    expect(universe.find(l => l.name === 'grape')).toMatchObject({
      placed: true,
      drawn: true,
    })
  })

  test('offers a copy under the floor unticked, and ticking every lane keeps it', () => {
    expect(universe.find(l => l.name === '{grape}chr4')).toEqual({
      name: '{grape}chr4',
      placed: true,
      drawn: false,
      underFloor: true,
    })
    expect(
      pickedLanes(
        {
          picked: universe.map(l => l.name),
          offered: universe.filter(l => !l.underFloor).map(l => l.name),
          inForce: undefined,
          configured: [],
        },
        keyOf,
      ),
    ).toEqual(['grape', '{grape}chr11', '{grape}chr4'])
  })
})

// a reload files the piece afresh, so it returns under its new first base
describe('a piece hidden or kept under the name an earlier filing gave it', () => {
  const { groups } = fileUnderPieces(
    groupFeatures(
      ['HG00097.1', 'HG00099.1'].map(
        (assemblyName, i) =>
          new SimpleFeature({
            uniqueId: `r${i}`,
            refName: 'chr1',
            start: 0,
            end: 5000,
            name: `g${i}`,
            mate: {
              assemblyName,
              refName: 'CM094061.1',
              start: 21_917_106,
              end: 21_922_106,
            },
          }),
      ),
    ),
    0,
  )
  const lanes = [...lanesPlacedIn(groups)]
  const piece = '{HG00097.1}CM094061.1[21917106]'
  const earlier = '{HG00097.1}CM094061.1[21912395]'
  const other = '{HG00099.1}CM094061.1[21917106]'
  const viewOf = (selection: string[] | undefined, hidden: string[]) => ({
    rows: laneRowsOf({
      groups,
      placeless: [],
      anchor: 'hg38',
      preferred: [],
      selection,
      hidden,
      keyOf,
    }),
    drawn: laneUniverseOf({
      anchor: 'hg38',
      mateNames: lanes,
      declared: [],
      trackAssemblies: [],
      keyOf,
      labelOf: name => name,
      selection,
      hidden,
      featuresLoaded: true,
      landedLanes: undefined,
    }).flatMap(lane => (lane.drawn ? [lane.name] : [])),
  })

  test('hidden, it stays out of the rows and the dialog, and showing its piece unhides it', () => {
    expect(lanes.toSorted()).toEqual([piece, other])
    const hidden = viewOf(undefined, [earlier])
    expect(hidden.rows).toEqual([other])
    expect(hidden.drawn).toEqual(hidden.rows)
    expect(
      withLaneShown(
        { kept: [], hidden: [earlier], configured: [], lanes },
        piece,
        keyOf,
      ),
    ).toEqual({ kept: [], hidden: [] })
  })

  test('kept, it draws in the rows and the dialog, and showing its piece leaves rows.kept as written', () => {
    const kept = viewOf([earlier], [])
    expect(kept.rows).toEqual([piece])
    expect(kept.drawn).toEqual(kept.rows)
    expect(
      withLaneShown(
        { kept: [earlier], hidden: [], configured: [], lanes },
        piece,
        keyOf,
      ),
    ).toEqual({ kept: [earlier], hidden: [] })
  })
})

test("the no-lane line counts a track's own lanes, and speaks for the file only where the track names none", () => {
  expect(noLanesPlacedText(8, true)).toBe(
    "None of this track's 8 haplotypes has sequence placed in this window",
  )
  expect(noLanesPlacedText(1, true)).toBe(
    "None of this track's 1 haplotype has sequence placed in this window",
  )
  expect(noLanesPlacedText(2, false)).toBe(
    "None of this track's 2 genomes has sequence placed in this window",
  )
  expect(noLanesPlacedText(0, true)).toBe(
    'No haplotype has sequence placed in this window',
  )
  expect(noLanesPlacedText(0, false)).toBe(
    'No genome has sequence placed in this window',
  )
})

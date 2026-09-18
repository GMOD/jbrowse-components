import { NO_VALUE_LABEL, categoricalField } from './categoricalField.ts'
import {
  MAX_LEGEND_CANDIDATES,
  MAX_LEGEND_ENTRIES,
  createLegendCandidateCollector,
  derivedColorScale,
  unionLegendCandidates,
} from './legendCandidates.ts'

import type { LegendCandidate } from './legendCandidates.ts'

const RED = 0xff0000ff
const GREEN = 0xff00ff00
const BLUE = 0xffff0000

// every row paints what the worker packed for it
const allRowsPaint = (candidates: readonly LegendCandidate[]) => ({
  candidates,
  rowPaintsCandidateColor: () => true,
})

function collect(triples: [number, string, number][], max?: number) {
  const collector = createLegendCandidateCollector(max)
  for (const [rowIndex, value, color] of triples) {
    collector.add(rowIndex, value, color)
  }
  return collector.candidates
}

describe('createLegendCandidateCollector', () => {
  test('keeps each (row, value, color) once, in first-seen order', () => {
    expect(
      collect([
        [0, 'TssA', RED],
        [0, 'Quies', GREEN],
        [0, 'TssA', RED],
        [1, 'TssA', RED],
      ]),
    ).toEqual([
      { rowIndex: 0, value: 'TssA', color: RED },
      { rowIndex: 0, value: 'Quies', color: GREEN },
      // same pair on another row: a different candidate, because that row may be
      // the only one still painting it
      { rowIndex: 1, value: 'TssA', color: RED },
    ])
  })

  test('keeps a second value on a color the union may need', () => {
    expect(
      collect([
        [0, 'TssA', RED],
        [1, 'TssA', GREEN],
        [1, 'Quies', GREEN],
      ]),
    ).toHaveLength(3)
  })

  test('the no-value key is a candidate like any other', () => {
    expect(collect([[0, '', GREEN]])).toEqual([
      { rowIndex: 0, value: '', color: GREEN },
    ])
  })

  test('the list is bounded whatever the data does', () => {
    // a track with a name and a color per feature — the shape a bounded list
    // exists for
    const triples = Array.from(
      { length: MAX_LEGEND_CANDIDATES * 3 },
      (_, i) => [i, `gene${i}`, 0xff000000 + i] as [number, string, number],
    )
    expect(collect(triples)).toHaveLength(MAX_LEGEND_CANDIDATES)
    expect(collect(triples, 4)).toHaveLength(4)
  })
})

describe('unionLegendCandidates', () => {
  test('one entry per distinct color, named by the first value in it', () => {
    const candidates = collect([
      [0, 'TssA', RED],
      [0, 'Quies', GREEN],
      [1, 'TssAFlnk', RED],
    ])
    expect(unionLegendCandidates([candidates], allRowsPaint)).toEqual([
      { value: 'TssA', color: RED },
      { value: 'Quies', color: GREEN },
    ])
  })

  test('a value reused across two colors keeps its first-seen color', () => {
    const candidates = collect([
      [0, 'TssA', RED],
      [0, 'TssA', BLUE],
    ])
    expect(unionLegendCandidates([candidates], allRowsPaint)).toEqual([
      { value: 'TssA', color: RED },
    ])
  })

  test('unions the regions, deduping across them', () => {
    const first = collect([[0, 'TssA', RED]])
    const second = collect([
      [0, 'TssA', RED],
      [0, 'Enh', BLUE],
    ])
    expect(unionLegendCandidates([first, second], allRowsPaint)).toEqual([
      { value: 'TssA', color: RED },
      { value: 'Enh', color: BLUE },
    ])
  })

  test('a row that paints something else contributes nothing', () => {
    const candidates = collect([
      [0, 'TssA', RED],
      [1, 'Quies', GREEN],
    ])
    expect(
      unionLegendCandidates([candidates], c => ({
        candidates: c,
        rowPaintsCandidateColor: rowIndex => rowIndex !== 0,
      })),
    ).toEqual([{ value: 'Quies', color: GREEN }])
  })

  test('past the entry bar there is no categorical key to show', () => {
    const candidates = collect(
      Array.from(
        { length: MAX_LEGEND_ENTRIES + 1 },
        (_, i) => [0, `gene${i}`, 0xff000000 + i] as [number, string, number],
      ),
    )
    expect(unionLegendCandidates([candidates], allRowsPaint)).toEqual([])
    // and the bar is the caller's to set
    expect(unionLegendCandidates([candidates], allRowsPaint, 2)).toEqual([])
  })

  test('pulls regions lazily, and stops once there is no key to find', () => {
    const lists = [
      collect([
        [0, 'TssA', RED],
        [0, 'Quies', GREEN],
      ]),
      collect([[0, 'Enh', BLUE]]),
    ]
    let pulled = 0
    function* regions() {
      for (const list of lists) {
        pulled++
        yield list
      }
    }
    expect(unionLegendCandidates(regions(), allRowsPaint, 1)).toEqual([])
    expect(pulled).toBe(1)
  })
})

describe('derivedColorScale', () => {
  const painted = collect([
    [0, '', GREEN],
    [0, 'Quies', BLUE],
    [0, 'TssA', RED],
  ])

  const values = (domain?: string[]) =>
    derivedColorScale([painted], allRowsPaint, {
      id: 'color',
      field: categoricalField('state', { domain }),
    }).flatMap(scale => (scale.kind === 'categorical' ? scale.entries : []))

  test('orders the values and leaves the no-value row last', () => {
    expect(values().map(e => e.value)).toEqual(['Quies', 'TssA', ''])
  })

  test('keeps it last under a declared domain, which never lists it', () => {
    expect(values(['TssA']).map(e => e.value)).toEqual(['TssA', 'Quies', ''])
  })

  test('names the field and each key, and carries the domain onto the scale', () => {
    expect(
      derivedColorScale([painted], allRowsPaint, {
        id: 'color',
        field: categoricalField('state', { domain: ['TssA'] }),
      }),
    ).toMatchObject([
      {
        kind: 'categorical',
        id: 'color',
        title: 'state',
        domain: ['TssA'],
        entries: [
          { value: 'TssA', label: 'TssA' },
          { value: 'Quies', label: 'Quies' },
          { value: '', label: NO_VALUE_LABEL, missing: true },
        ],
      },
    ])
  })

  test('is no scale at all where every row is one color', () => {
    expect(
      derivedColorScale([collect([[0, 'TssA', RED]])], allRowsPaint, {
        id: 'color',
        field: categoricalField('state'),
      }),
    ).toEqual([])
  })
})

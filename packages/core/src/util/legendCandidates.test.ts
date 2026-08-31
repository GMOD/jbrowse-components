import {
  MAX_LEGEND_CANDIDATES,
  MAX_LEGEND_ENTRIES,
  createLegendCandidateCollector,
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
  for (const [rowIndex, label, color] of triples) {
    collector.add(rowIndex, label, color)
  }
  return collector.candidates
}

describe('createLegendCandidateCollector', () => {
  test('keeps each (row, name, color) once, in first-seen order', () => {
    expect(
      collect([
        [0, 'TssA', RED],
        [0, 'Quies', GREEN],
        [0, 'TssA', RED],
        [1, 'TssA', RED],
      ]),
    ).toEqual([
      { rowIndex: 0, label: 'TssA', color: RED },
      { rowIndex: 0, label: 'Quies', color: GREEN },
      // same pair on another row: a different candidate, because that row may be
      // the only one still painting it
      { rowIndex: 1, label: 'TssA', color: RED },
    ])
  })

  test('keeps a second name on a color the union may need', () => {
    // the union takes the first NAME for a color, so dropping this by (row,
    // color) would lose green entirely once 'TssA' is spoken for
    expect(
      collect([
        [0, 'TssA', RED],
        [1, 'TssA', GREEN],
        [1, 'Quies', GREEN],
      ]),
    ).toHaveLength(3)
  })

  test('a nameless feature contributes nothing', () => {
    expect(
      collect([
        [0, '', RED],
        [1, '', GREEN],
      ]),
    ).toEqual([])
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
  test('one entry per distinct color, named by the first name in it', () => {
    const candidates = collect([
      [0, 'TssA', RED],
      [0, 'Quies', GREEN],
      [1, 'TssAFlnk', RED],
    ])
    expect(unionLegendCandidates([candidates], allRowsPaint)).toEqual([
      { label: 'TssA', color: RED },
      { label: 'Quies', color: GREEN },
    ])
  })

  test('a name reused across two colors keeps its first-seen color', () => {
    const candidates = collect([
      [0, 'TssA', RED],
      [0, 'TssA', BLUE],
    ])
    expect(unionLegendCandidates([candidates], allRowsPaint)).toEqual([
      { label: 'TssA', color: RED },
    ])
  })

  test('unions the regions, deduping across them', () => {
    const first = collect([[0, 'TssA', RED]])
    const second = collect([
      [0, 'TssA', RED],
      [0, 'Enh', BLUE],
    ])
    expect(unionLegendCandidates([first, second], allRowsPaint)).toEqual([
      { label: 'TssA', color: RED },
      { label: 'Enh', color: BLUE },
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
    ).toEqual([{ label: 'Quies', color: GREEN }])
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

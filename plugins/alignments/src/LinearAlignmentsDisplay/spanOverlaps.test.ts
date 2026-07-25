import { mergeSpans, overlapIntervals } from './spanOverlaps.ts'

describe('overlapIntervals', () => {
  test('disjoint spans produce no overlaps', () => {
    expect(
      overlapIntervals([
        { start: 0, end: 100 },
        { start: 100, end: 200 },
      ]),
    ).toEqual([])
  })

  test('two overlapping spans yield their intersection', () => {
    expect(
      overlapIntervals([
        { start: 0, end: 150 },
        { start: 100, end: 250 },
      ]),
    ).toEqual([{ start: 100, end: 150 }])
  })

  test('a fully contained span yields its own extent', () => {
    expect(
      overlapIntervals([
        { start: 0, end: 300 },
        { start: 100, end: 200 },
      ]),
    ).toEqual([{ start: 100, end: 200 }])
  })

  test('input order does not matter', () => {
    expect(
      overlapIntervals([
        { start: 100, end: 250 },
        { start: 0, end: 150 },
      ]),
    ).toEqual([{ start: 100, end: 150 }])
  })

  test('three mutually overlapping spans emit one interval per later span', () => {
    expect(
      overlapIntervals([
        { start: 0, end: 200 },
        { start: 100, end: 300 },
        { start: 150, end: 400 },
      ]),
    ).toEqual([
      { start: 100, end: 200 },
      { start: 150, end: 300 },
    ])
  })

  test('a span overlapping only an earlier longer span clamps to its end', () => {
    // second span sets runningMaxEnd=500; third starts inside it but ends short
    expect(
      overlapIntervals([
        { start: 0, end: 50 },
        { start: 100, end: 500 },
        { start: 200, end: 300 },
      ]),
    ).toEqual([{ start: 200, end: 300 }])
  })

  test('empty and single-span inputs produce no overlaps', () => {
    expect(overlapIntervals([])).toEqual([])
    expect(overlapIntervals([{ start: 0, end: 100 }])).toEqual([])
  })
})

describe('mergeSpans', () => {
  test('overlapping spans collapse into their union', () => {
    expect(
      mergeSpans([
        { start: 100, end: 200 },
        { start: 150, end: 300 },
      ]),
    ).toEqual([{ start: 100, end: 300 }])
  })

  test('touching spans merge', () => {
    expect(
      mergeSpans([
        { start: 0, end: 100 },
        { start: 100, end: 200 },
      ]),
    ).toEqual([{ start: 0, end: 200 }])
  })

  test('disjoint spans are kept separate and sorted', () => {
    expect(
      mergeSpans([
        { start: 300, end: 400 },
        { start: 0, end: 100 },
      ]),
    ).toEqual([
      { start: 0, end: 100 },
      { start: 300, end: 400 },
    ])
  })

  test('merging the stacked output of overlapIntervals yields one span (no double-blend)', () => {
    const spans = [
      { start: 0, end: 200 },
      { start: 100, end: 300 },
      { start: 150, end: 400 },
    ]
    expect(mergeSpans(overlapIntervals(spans))).toEqual([
      { start: 100, end: 300 },
    ])
  })
})

// The property the collapsed-group tint depends on: alpha-blending the raw
// (unmerged) output darkens each position exactly in proportion to how many
// spans cover it.
describe('overlapIntervals depth property', () => {
  function tintCountAt(spans: { start: number; end: number }[], pos: number) {
    return overlapIntervals(spans).filter(s => pos >= s.start && pos < s.end)
      .length
  }
  function depthAt(spans: { start: number; end: number }[], pos: number) {
    return spans.filter(s => pos >= s.start && pos < s.end).length
  }

  const cases = [
    [
      { start: 0, end: 100 },
      { start: 0, end: 100 },
      { start: 0, end: 100 },
    ],
    [
      { start: 0, end: 100 },
      { start: 10, end: 90 },
      { start: 20, end: 30 },
    ],
    [
      { start: 0, end: 10 },
      { start: 20, end: 100 },
      { start: 0, end: 100 },
    ],
    [
      { start: 0, end: 100 },
      { start: 10, end: 20 },
      { start: 30, end: 40 },
      { start: 35, end: 60 },
    ],
  ]

  test.each(cases.map((spans, i) => [i, spans] as const))(
    'case %i tints every position depth-1 times',
    (_i, spans) => {
      for (let pos = 0; pos < 110; pos++) {
        expect(tintCountAt(spans, pos)).toBe(
          Math.max(0, depthAt(spans, pos) - 1),
        )
      }
    },
  )
})

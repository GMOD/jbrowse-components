import {
  mergeSortedSpans,
  packedOverlapIntervals,
  subtractSortedSpans,
} from './spanOverlaps.ts'

import type { Span } from './spanOverlaps.ts'

function overlapSpans(spans: Span[]) {
  const packed = packedOverlapIntervals(
    Uint32Array.from(spans.flatMap(s => [s.start, s.end])),
    spans.length,
  )
  return Array.from({ length: packed.length / 2 }, (_, i) => ({
    start: packed[i * 2]!,
    end: packed[i * 2 + 1]!,
  }))
}

describe('packedOverlapIntervals', () => {
  test('disjoint spans produce no overlaps', () => {
    expect(
      overlapSpans([
        { start: 0, end: 100 },
        { start: 100, end: 200 },
      ]),
    ).toEqual([])
  })

  test('two overlapping spans yield their intersection', () => {
    expect(
      overlapSpans([
        { start: 0, end: 150 },
        { start: 100, end: 250 },
      ]),
    ).toEqual([{ start: 100, end: 150 }])
  })

  test('a fully contained span yields its own extent', () => {
    expect(
      overlapSpans([
        { start: 0, end: 300 },
        { start: 100, end: 200 },
      ]),
    ).toEqual([{ start: 100, end: 200 }])
  })

  test('input order does not matter', () => {
    expect(
      overlapSpans([
        { start: 100, end: 250 },
        { start: 0, end: 150 },
      ]),
    ).toEqual([{ start: 100, end: 150 }])
  })

  test('three mutually overlapping spans emit one interval per later span', () => {
    expect(
      overlapSpans([
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
      overlapSpans([
        { start: 0, end: 50 },
        { start: 100, end: 500 },
        { start: 200, end: 300 },
      ]),
    ).toEqual([{ start: 200, end: 300 }])
  })

  test('empty and single-span inputs produce no overlaps', () => {
    expect(overlapSpans([])).toEqual([])
    expect(overlapSpans([{ start: 0, end: 100 }])).toEqual([])
  })

  test('ties on start keep input order', () => {
    expect(
      overlapSpans([
        { start: 0, end: 30 },
        { start: 0, end: 10 },
        { start: 0, end: 20 },
      ]),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 0, end: 20 },
    ])
  })

  test('the returned array is exactly the intervals found', () => {
    expect(
      packedOverlapIntervals(Uint32Array.from([0, 200, 100, 300]), 2).length,
    ).toBe(2)
    expect(
      packedOverlapIntervals(Uint32Array.from([0, 100, 100, 200]), 2).length,
    ).toBe(0)
  })
})

describe('mergeSortedSpans', () => {
  test('overlapping spans collapse into their union', () => {
    expect(
      mergeSortedSpans([
        { start: 100, end: 200 },
        { start: 150, end: 300 },
      ]),
    ).toEqual([{ start: 100, end: 300 }])
  })

  test('touching spans merge', () => {
    expect(
      mergeSortedSpans([
        { start: 0, end: 100 },
        { start: 100, end: 200 },
      ]),
    ).toEqual([{ start: 0, end: 200 }])
  })

  test('disjoint spans are kept separate', () => {
    expect(
      mergeSortedSpans([
        { start: 0, end: 100 },
        { start: 300, end: 400 },
      ]),
    ).toEqual([
      { start: 0, end: 100 },
      { start: 300, end: 400 },
    ])
  })
})

// Span sets with every overlap shape the tint has to survive.
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

// The property the collapsed-group tint depends on: alpha-blending the raw
// (unmerged) output darkens each position exactly in proportion to how many
// spans cover it.
describe('packedOverlapIntervals depth property', () => {
  function tintCountAt(spans: Span[], pos: number) {
    return overlapSpans(spans).filter(s => pos >= s.start && pos < s.end).length
  }
  function depthAt(spans: Span[], pos: number) {
    return spans.filter(s => pos >= s.start && pos < s.end).length
  }

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

describe('subtractSortedSpans', () => {
  const span = (start: number, end: number) => ({ start, end })

  test('nothing removed keeps every span', () => {
    expect(subtractSortedSpans([span(0, 10)], [])).toEqual([span(0, 10)])
  })

  test('a removal inside a span splits it', () => {
    expect(subtractSortedSpans([span(0, 100)], [span(40, 60)])).toEqual([
      span(0, 40),
      span(60, 100),
    ])
  })

  test('removals over either edge trim it, and a covered span is dropped', () => {
    expect(
      subtractSortedSpans(
        [span(0, 100), span(200, 300), span(400, 500)],
        [span(-10, 20), span(90, 150), span(190, 310), span(480, 600)],
      ),
    ).toEqual([span(20, 90), span(400, 480)])
  })

  test('one removal can cut two spans', () => {
    expect(
      subtractSortedSpans([span(0, 50), span(60, 100)], [span(40, 70)]),
    ).toEqual([span(0, 40), span(70, 100)])
  })
})

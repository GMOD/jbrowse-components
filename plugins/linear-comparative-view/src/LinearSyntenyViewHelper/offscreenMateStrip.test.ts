import {
  offscreenMateCount,
  offscreenMateHit,
  offscreenMateStrip,
} from './offscreenMateStrip.ts'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

function mates(n: number): OffscreenMateData {
  return {
    mateRefNameDict: ['other'],
    counts: Uint32Array.from([n]),
    starts: Float64Array.from({ length: n }, (_, i) => i * 100),
    ends: Float64Array.from({ length: n }, (_, i) => i * 100 + 50),
    mateRefNameIds: new Uint32Array(n),
  }
}

function named(refName: string): OffscreenMateData {
  return { ...mates(1), mateRefNameDict: [refName] }
}

const QUERY_ROW = { bpPerPx: 2, offsetPx: 10 }
const TARGET_ROW = { bpPerPx: 99, offsetPx: 999 }

function source(over: Record<string, unknown> = {}) {
  return {
    level: 0,
    linearSyntenyDisplays: [{ featureData: { offscreenMates: mates(3) } }],
    parentView: {
      showOffscreenMates: true,
      minAlignmentLength: 0,
      views: [QUERY_ROW, TARGET_ROW],
    },
    ...over,
  }
}

// The one mistake here that draws something plausible instead of nothing: these
// have no position on the row below, so measuring them against its ruler puts
// every mark at a believable wrong offset.
test('marks are measured against the query row, not the row below', () => {
  expect(offscreenMateStrip(source())).toMatchObject({
    bpPerPx: 2,
    offsetPx: 10,
  })
})

test('an interior level reads its own upper row', () => {
  expect(
    offscreenMateStrip(
      source({
        level: 1,
        parentView: {
          showOffscreenMates: true,
          minAlignmentLength: 0,
          views: [{ bpPerPx: 1, offsetPx: 1 }, QUERY_ROW, TARGET_ROW],
        },
      }),
    ),
  ).toMatchObject({ bpPerPx: 2, offsetPx: 10 })
})

test('the toggle off draws nothing', () => {
  expect(
    offscreenMateStrip(
      source({
        parentView: {
          showOffscreenMates: false,
          minAlignmentLength: 0,
          views: [QUERY_ROW, TARGET_ROW],
        },
      }),
    ),
  ).toBeUndefined()
})

test('a display that has not fetched contributes nothing', () => {
  expect(
    offscreenMateStrip(source({ linearSyntenyDisplays: [{}] })),
  ).toBeUndefined()
})

test('a display with nothing hidden contributes nothing to draw', () => {
  expect(
    offscreenMateStrip(
      source({
        linearSyntenyDisplays: [{ featureData: { offscreenMates: mates(0) } }],
      }),
    ),
  ).toBeUndefined()
})

test('every display on the level is drawn, not just the first', () => {
  expect(
    offscreenMateStrip(
      source({
        linearSyntenyDisplays: [
          { featureData: { offscreenMates: mates(3) } },
          { featureData: { offscreenMates: mates(2) } },
        ],
      }),
    )?.datasets,
  ).toHaveLength(2)
})

test('a level whose row is gone draws nothing rather than throwing', () => {
  expect(
    offscreenMateStrip(
      source({
        parentView: {
          showOffscreenMates: true,
          minAlignmentLength: 0,
          views: [],
        },
      }),
    ),
  ).toBeUndefined()
})

// The strip the level's own handlers ask about before they ask the pick engine.
// `offscreenMateAt` owns the geometry; what this adds is reading it across every
// display on the level and against the level's width and height.
test('a pointer in the strip answers the contig that mark points at', () => {
  expect(
    offscreenMateHit(
      {
        ...source(),
        height: 100,
        parentView: { ...source().parentView, width: 800 },
      },
      1,
      1,
    ),
  ).toBe('other')
})

test('below the strip answers nothing, leaving the ribbons to the pick engine', () => {
  expect(
    offscreenMateHit(
      {
        ...source(),
        height: 100,
        parentView: { ...source().parentView, width: 800 },
      },
      1,
      50,
    ),
  ).toBeUndefined()
})

test('with the toggle off nothing is hittable, since nothing is drawn', () => {
  const s = source({
    parentView: {
      showOffscreenMates: false,
      minAlignmentLength: 0,
      views: [QUERY_ROW, TARGET_ROW],
    },
  })
  expect(
    offscreenMateHit(
      { ...s, height: 100, parentView: { ...s.parentView, width: 800 } },
      1,
      1,
    ),
  ).toBeUndefined()
})

test('a second display on the level is asked too', () => {
  const s = source({
    linearSyntenyDisplays: [
      { featureData: { offscreenMates: mates(0) } },
      { featureData: { offscreenMates: named('ctgQ') } },
    ],
  })
  expect(
    offscreenMateHit(
      { ...s, height: 100, parentView: { ...s.parentView, width: 800 } },
      1,
      1,
    ),
  ).toBe('ctgQ')
})

// The number the hover reads, and the one the hamburger item reports for the
// same contig — one tally behind both, so they cannot drift.
test('the count sums every display on the level', () => {
  const both = source({
    linearSyntenyDisplays: [
      {
        featureData: {
          offscreenMates: { ...mates(3), counts: Uint32Array.from([3]) },
        },
      },
      {
        featureData: {
          offscreenMates: { ...mates(2), counts: Uint32Array.from([2]) },
        },
      },
    ],
  })
  expect(offscreenMateCount(both, 'other')).toBe(5)
})

test('a contig this band has nothing to say about counts zero', () => {
  expect(offscreenMateCount(source(), 'ctgQ')).toBe(0)
})

test('a display that has not fetched counts nothing rather than throwing', () => {
  expect(
    offscreenMateCount(source({ linearSyntenyDisplays: [{}] }), 'other'),
  ).toBe(0)
})

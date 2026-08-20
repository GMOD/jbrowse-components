import {
  offscreenMateCount,
  offscreenMateHit,
  offscreenMateStrips,
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
// Deliberately nowhere near the query row's ruler, so a strip read against the
// wrong one lands somewhere no assertion below could mistake for right.
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

// The mirror: alignments anchored on the row BELOW, whose query end is on a
// contig the row above is not displaying. Only a bidirectional fetch produces
// these, and they are placed against the lower row's own ruler.
function bothSides(over: Record<string, unknown> = {}) {
  return {
    level: 0,
    linearSyntenyDisplays: [
      {
        featureData: {
          offscreenMates: named('fromQuery'),
          targetOffscreenMates: named('fromTarget'),
        },
      },
    ],
    parentView: {
      showOffscreenMates: true,
      minAlignmentLength: 0,
      views: [QUERY_ROW, QUERY_ROW],
    },
    ...over,
  }
}

function withBand(model: ReturnType<typeof source>, width = 800, height = 100) {
  return { ...model, height, parentView: { ...model.parentView, width } }
}

// The one mistake here that draws something plausible instead of nothing: these
// have no position on the row below, so measuring them against its ruler puts
// every mark at a believable wrong offset.
test('query-axis marks are measured against the query row, not the row below', () => {
  expect(offscreenMateStrips(source())).toMatchObject([
    { bpPerPx: 2, offsetPx: 10, side: 'top' },
  ])
})

test('an interior level reads its own upper row', () => {
  expect(
    offscreenMateStrips(
      source({
        level: 1,
        parentView: {
          showOffscreenMates: true,
          minAlignmentLength: 0,
          views: [{ bpPerPx: 1, offsetPx: 1 }, QUERY_ROW, TARGET_ROW],
        },
      }),
    ),
  ).toMatchObject([{ bpPerPx: 2, offsetPx: 10 }])
})

test('the toggle off draws nothing', () => {
  expect(
    offscreenMateStrips(
      source({
        parentView: {
          showOffscreenMates: false,
          minAlignmentLength: 0,
          views: [QUERY_ROW, TARGET_ROW],
        },
      }),
    ),
  ).toEqual([])
})

test('a display that has not fetched contributes nothing', () => {
  expect(offscreenMateStrips(source({ linearSyntenyDisplays: [{}] }))).toEqual(
    [],
  )
})

test('a display with nothing hidden contributes nothing to draw', () => {
  expect(
    offscreenMateStrips(
      source({
        linearSyntenyDisplays: [{ featureData: { offscreenMates: mates(0) } }],
      }),
    ),
  ).toEqual([])
})

test('every display on the level is drawn, not just the first', () => {
  expect(
    offscreenMateStrips(
      source({
        linearSyntenyDisplays: [
          { featureData: { offscreenMates: mates(3) } },
          { featureData: { offscreenMates: mates(2) } },
        ],
      }),
    )[0]?.datasets,
  ).toHaveLength(2)
})

test('a level whose row is gone draws nothing rather than throwing', () => {
  expect(
    offscreenMateStrips(
      source({
        parentView: {
          showOffscreenMates: true,
          minAlignmentLength: 0,
          views: [],
        },
      }),
    ),
  ).toEqual([])
})

// The mirror class hangs off the OTHER edge against the OTHER ruler, and a
// click on one has to navigate the other row: a query-axis mark names a contig
// the row below is not showing, and a target-axis mark names one the row above
// is not.
test('the target axis gets its own strip, on the far edge and the far row', () => {
  expect(offscreenMateStrips(bothSides())).toMatchObject([
    { side: 'top', navRow: 1 },
    { side: 'bottom', navRow: 0 },
  ])
})

test('a level with only query-side mates has one strip', () => {
  expect(offscreenMateStrips(source())).toHaveLength(1)
})

// Without the second fetch the mirror lane is empty, so nothing is drawn for it
// — as opposed to a lane of zeroes drawn at the bottom of every band.
test('an empty mirror lane is not a second strip', () => {
  expect(
    offscreenMateStrips(
      bothSides({
        linearSyntenyDisplays: [
          {
            featureData: {
              offscreenMates: named('fromQuery'),
              targetOffscreenMates: mates(0),
            },
          },
        ],
      }),
    ),
  ).toHaveLength(1)
})

// The strip the level's own handlers ask about before they ask the pick engine.
// `offscreenMateAt` owns the geometry; what this adds is reading it across every
// display on the level and against the level's width and height.
test('a pointer in the strip answers the contig that mark points at', () => {
  expect(offscreenMateHit(withBand(source()), 1, 1)?.refName).toBe('other')
})

test('below the strip answers nothing, leaving the ribbons to the pick engine', () => {
  expect(offscreenMateHit(withBand(source()), 1, 50)).toBeUndefined()
})

test('with the toggle off nothing is hittable, since nothing is drawn', () => {
  const s = source({
    parentView: {
      showOffscreenMates: false,
      minAlignmentLength: 0,
      views: [QUERY_ROW, TARGET_ROW],
    },
  })
  expect(offscreenMateHit(withBand(s), 1, 1)).toBeUndefined()
})

test('a second display on the level is asked too', () => {
  const s = source({
    linearSyntenyDisplays: [
      { featureData: { offscreenMates: mates(0) } },
      { featureData: { offscreenMates: named('ctgQ') } },
    ],
  })
  expect(offscreenMateHit(withBand(s), 1, 1)?.refName).toBe('ctgQ')
})

// The two strips are at opposite edges of the band, so which one a pointer is
// in decides both what it names and which row a click on it moves.
test('a pointer at the bottom edge answers the target axis, and the row above', () => {
  expect(offscreenMateHit(withBand(bothSides()), 1, 99)).toEqual({
    refName: 'fromTarget',
    navRow: 0,
  })
})

test('a pointer at the top edge still answers the query axis', () => {
  expect(offscreenMateHit(withBand(bothSides()), 1, 1)).toEqual({
    refName: 'fromQuery',
    navRow: 1,
  })
})

test('the band between the two strips is neither', () => {
  expect(offscreenMateHit(withBand(bothSides()), 1, 50)).toBeUndefined()
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

// ...and both lanes, since which strip the pointer is in is not something the
// count is told: a mark on the lower edge names a contig only the mirror lane
// holds, and reading the query lane alone reported it as nothing at all.
test('the count reads the mirror lane too', () => {
  expect(offscreenMateCount(bothSides(), 'fromTarget')).toBe(1)
})

test('a contig this band has nothing to say about counts zero', () => {
  expect(offscreenMateCount(source(), 'ctgQ')).toBe(0)
})

test('a display that has not fetched counts nothing rather than throwing', () => {
  expect(
    offscreenMateCount(source({ linearSyntenyDisplays: [{}] }), 'other'),
  ).toBe(0)
})

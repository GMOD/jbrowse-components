import {
  offscreenMateTotals,
  offscreenMateHit,
  offscreenMateStrips,
} from './offscreenMateStrip.ts'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import type { OffscreenMateSource } from './offscreenMateStrip.ts'

function mates(n: number): OffscreenMateData {
  return {
    mateRefNameDict: ['other'],
    counts: Uint32Array.from([n]),
    alignedBp: Float64Array.from([n * 50]),
    starts: Float64Array.from({ length: n }, (_, i) => i * 100),
    ends: Float64Array.from({ length: n }, (_, i) => i * 100 + 50),
    mateRefNameIds: new Uint32Array(n),
    lengths: Float32Array.from({ length: n }, () => 50),
    mateStarts: Float64Array.from({ length: n }, (_, i) => i * 1000),
    mateEnds: Float64Array.from({ length: n }, (_, i) => i * 1000 + 500),
  }
}

function named(refName: string): OffscreenMateData {
  return { ...mates(1), mateRefNameDict: [refName] }
}

const QUERY_ROW = { bpPerPx: 2, offsetPx: 10 }
// Deliberately nowhere near the query row's ruler, so a strip read against the
// wrong one lands somewhere no assertion below could mistake for right.
const TARGET_ROW = { bpPerPx: 99, offsetPx: 999 }

function source(over: Record<string, unknown> = {}): OffscreenMateSource {
  return {
    level: 0,
    rowPair: { v0: QUERY_ROW, v1: TARGET_ROW },
    height: 100,
    linearSyntenyDisplays: [{ mateMarks: { offscreenMates: mates(3) } }],
    parentView: {
      showOffscreenMates: true,
      minAlignmentLength: 0,
      overdrawPx: 1000,
      width: 800,
    },
    ...over,
  }
}

// The mirror: alignments anchored on the row BELOW, whose query end is on a
// contig the row above is not displaying. Only a payload that queried the
// lower row carries these, and the lower strip is drawn only from one that did.
function bothSides(over: Record<string, unknown> = {}): OffscreenMateSource {
  return {
    level: 0,
    rowPair: { v0: QUERY_ROW, v1: QUERY_ROW },
    height: 100,
    linearSyntenyDisplays: [
      {
        mateMarks: {
          offscreenMates: named('fromQuery'),
          targetOffscreenMates: named('fromTarget'),
          targetQueried: true,
        },
      },
    ],
    parentView: {
      showOffscreenMates: true,
      minAlignmentLength: 0,
      overdrawPx: 1000,
      width: 800,
    },
    ...over,
  }
}

function hit(model: OffscreenMateSource, x: number, y: number) {
  return offscreenMateHit(offscreenMateStrips(model), x, y)
}

// The one mistake here that draws something plausible instead of nothing: these
// have no position on the row below, so measuring them against its ruler puts
// every mark at a believable wrong offset.
test('query-axis marks are measured against the query row, not the row below', () => {
  expect(offscreenMateStrips(source())).toMatchObject([
    { bpPerPx: 2, offsetPx: 10, side: 'top' },
  ])
})

test('an interior level navigates the rows by its own place in the stack', () => {
  expect(offscreenMateStrips(bothSides({ level: 1 }))).toMatchObject([
    { side: 'top', navRow: 2 },
    { side: 'bottom', navRow: 1 },
  ])
})

test('the toggle off draws nothing', () => {
  expect(
    offscreenMateStrips(
      source({
        parentView: { showOffscreenMates: false, minAlignmentLength: 0 },
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
        linearSyntenyDisplays: [{ mateMarks: { offscreenMates: mates(0) } }],
      }),
    ),
  ).toEqual([])
})

test('every display on the level is drawn, not just the first', () => {
  expect(
    offscreenMateStrips(
      source({
        linearSyntenyDisplays: [
          { mateMarks: { offscreenMates: mates(3) } },
          { mateMarks: { offscreenMates: mates(2) } },
        ],
      }),
    )[0]?.datasets,
  ).toHaveLength(2)
})

test('a level whose row is gone draws nothing rather than throwing', () => {
  expect(offscreenMateStrips(source({ rowPair: undefined }))).toEqual([])
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
            mateMarks: {
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
  expect(hit(source(), 1, 1)?.refName).toBe('other')
})

test('below the strip answers nothing, leaving the ribbons to the pick engine', () => {
  expect(hit(source(), 1, 50)).toBeUndefined()
})

test('with the toggle off nothing is hittable, since nothing is drawn', () => {
  const s = source({
    parentView: { showOffscreenMates: false, minAlignmentLength: 0 },
  })
  expect(hit(s, 1, 1)).toBeUndefined()
})

test('a second display on the level is asked too', () => {
  const s = source({
    linearSyntenyDisplays: [
      { mateMarks: { offscreenMates: mates(0) } },
      { mateMarks: { offscreenMates: named('ctgQ') } },
    ],
  })
  expect(hit(s, 1, 1)?.refName).toBe('ctgQ')
})

// The two strips are at opposite edges of the band, so which one a pointer is
// in decides both what it names and which row a click on it moves.
test('a pointer at the bottom edge answers the target axis, and the row above', () => {
  expect(hit(bothSides(), 1, 99)).toEqual({
    refName: 'fromTarget',
    navRow: 0,
    side: 'bottom',
    locus: { start: 0, end: 500 },
    // the worker's class: no place on the facing axis at all, so nowhere to
    // scroll to and no drawn span to carry
    mateCumBp: undefined,
  })
})

test('a pointer at the top edge still answers the query axis', () => {
  expect(hit(bothSides(), 1, 1)).toMatchObject({
    refName: 'fromQuery',
    navRow: 1,
    side: 'top',
    mateCumBp: undefined,
  })
})

test('the band between the two strips is neither', () => {
  expect(hit(bothSides(), 1, 50)).toBeUndefined()
})

// The numbers the hover reads — sequence and alignments, one tally behind both,
// so they cannot drift from each other or from the ranking they decide.
test('the totals sum every display on the level', () => {
  const both = source({
    linearSyntenyDisplays: [
      {
        mateMarks: {
          offscreenMates: { ...mates(3), counts: Uint32Array.from([3]) },
        },
      },
      {
        mateMarks: {
          offscreenMates: { ...mates(2), counts: Uint32Array.from([2]) },
        },
      },
    ],
  })
  expect(offscreenMateTotals(both, 'other', 'top')).toEqual({
    alignments: 5,
    alignedBp: 250,
  })
})

// ...one lane at a time, named by the caller: the two hold contigs of different
// assemblies, so a refName alone does not say which tally it belongs to.
test('the totals read the lane they are asked for', () => {
  expect(
    offscreenMateTotals(bothSides(), 'fromTarget', 'bottom').alignments,
  ).toBe(1)
  expect(offscreenMateTotals(bothSides(), 'fromTarget', 'top').alignments).toBe(
    0,
  )
})

test('a contig this band has nothing to say about totals zero', () => {
  expect(offscreenMateTotals(source(), 'ctgQ', 'top')).toEqual({
    alignments: 0,
    alignedBp: 0,
  })
})

test('a display that has not fetched totals nothing rather than throwing', () => {
  expect(
    offscreenMateTotals(source({ linearSyntenyDisplays: [{}] }), 'other', 'top')
      .alignments,
  ).toBe(0)
})

// The class the worker cannot see: the alignment is drawn on BOTH axes, and
// whether it is a mark is a question about where the facing row currently sits.
// One perspective per row, since either end can be the one that scrolled off.
function culled(refName: string, [lo, hi]: [number, number]) {
  return {
    ...named(refName),
    mateAxis: {
      starts: Float64Array.from([lo]),
      ends: Float64Array.from([hi]),
      lo,
      hi,
    },
  }
}

// Nothing the worker's two lanes hold, and the whole of what the lower strip was
// missing: a ribbon culled because the row ABOVE scrolled off its query end
// still has a target-axis position, and the bottom strip is the only surface
// that can stand in for it. Marked on the query axis alone it landed at an x the
// layout rejects, so it drew nowhere at all.
test('the bottom strip marks the ribbons the row above culled', () => {
  const model = bothSides({
    linearSyntenyDisplays: [
      {
        mateMarks: {
          offscreenMates: mates(0),
          targetOffscreenMates: mates(0),
          targetQueried: true,
        },
        culledRibbonMates: {
          onQueryAxis: culled('inBand', [0, 50]),
          onTargetAxis: culled('scrolledAway', [100_000, 100_050]),
        },
      },
    ],
  })
  expect(offscreenMateStrips(model)).toMatchObject([
    { side: 'bottom', navRow: 0 },
  ])
  expect(hit(model, 1, 99)).toMatchObject({
    refName: 'scrolledAway',
    mateCumBp: { start: 100_000, end: 100_050 },
  })
})

// The same test the top strip's culled lane runs, on the other row's band: an
// alignment whose query end is still inside the band above is a RIBBON, and
// marking it would put a mark beside the thing it says is not there.
test('an alignment the row above is still showing is no mark down there', () => {
  expect(
    offscreenMateStrips(
      bothSides({
        linearSyntenyDisplays: [
          {
            mateMarks: {
              offscreenMates: mates(0),
              targetOffscreenMates: mates(0),
              targetQueried: true,
            },
            culledRibbonMates: {
              onQueryAxis: culled('inBand', [0, 50]),
              onTargetAxis: culled('inBand', [0, 50]),
            },
          },
        ],
      }),
    ),
  ).toEqual([])
})

// A contig the row above is DISPLAYING and has merely scrolled off is scrolled
// to, not navigated to — `navToLocString` would replace that row's regions to
// show a contig it already has. The presence of the mate lane is what says which
// of the two a mark is, and it has to survive the transpose.
test('a culled bottom mark clicks through as a contig that row already has', () => {
  const model = bothSides({
    linearSyntenyDisplays: [
      {
        mateMarks: {
          offscreenMates: mates(0),
          targetOffscreenMates: mates(0),
          targetQueried: true,
        },
        culledRibbonMates: {
          onQueryAxis: culled('inBand', [0, 50]),
          onTargetAxis: culled('scrolledAway', [100_000, 100_050]),
        },
      },
    ],
  })
  expect(hit(model, 1, 99)).toMatchObject({
    refName: 'scrolledAway',
    navRow: 0,
    side: 'bottom',
    mateCumBp: { start: 100_000, end: 100_050 },
  })
})

// A ZERO-WIDTH BLOCK EXTENT IS STILL A PLACE. Dropped, the click fell back to
// the whole contig — the answer these coordinates exist to replace — and on
// this class of mark that fallback is `navToLocString`, which replaces the
// regions of the very row the mark says already has the contig. The DRAWN span
// is what the click steers by and what says the mark is this class at all, so a
// collapsed block extent costs it neither.
test('a mark whose mate span collapses still resolves to a place', () => {
  const point = {
    ...culled('scrolledAway', [100_000, 100_050]),
    mateStarts: Float64Array.from([7_000]),
    mateEnds: Float64Array.from([7_000]),
  }
  const model = bothSides({
    linearSyntenyDisplays: [
      {
        mateMarks: {
          offscreenMates: mates(0),
          targetOffscreenMates: mates(0),
          targetQueried: true,
        },
        culledRibbonMates: {
          onQueryAxis: culled('inBand', [0, 50]),
          onTargetAxis: point,
        },
      },
    ],
  })
  expect(hit(model, 1, 99)).toMatchObject({
    refName: 'scrolledAway',
    locus: { start: 7_000, end: 7_000 },
    mateCumBp: { start: 100_000, end: 100_050 },
  })
})

// A culled target-axis mark is an alignment whose query end is off the row
// above, so a single fetch holds only the ones inside its pan buffer: the strip
// would stop at the fetch window's edge rather than at the data's. The gate is
// the payload, not the live setting, so switching the second query on does not
// draw the previous fetch's fraction for the round trip it takes to land.
test('a payload that did not query the lower row draws no lower strip', () => {
  const model = bothSides({
    linearSyntenyDisplays: [
      {
        mateMarks: {
          offscreenMates: mates(0),
          targetOffscreenMates: mates(0),
          targetQueried: false,
        },
        culledRibbonMates: {
          onQueryAxis: culled('inBand', [0, 50]),
          onTargetAxis: culled('scrolledAway', [100_000, 100_050]),
        },
      },
    ],
  })
  expect(offscreenMateStrips(model)).toEqual([])
  expect(hit(model, 1, 99)).toBeUndefined()
})

// The tally is the half of it that would be a wrong NUMBER rather than a
// missing mark, so it goes silent by the same gate and not by a second one.
test('an ungated lower lane is not counted either', () => {
  expect(
    offscreenMateTotals(bothSides(), 'fromTarget', 'bottom').alignments,
  ).toBe(1)
  expect(
    offscreenMateTotals(
      bothSides({
        linearSyntenyDisplays: [
          {
            mateMarks: {
              offscreenMates: named('fromQuery'),
              targetOffscreenMates: named('fromTarget'),
              targetQueried: false,
            },
          },
        ],
      }),
      'fromTarget',
      'bottom',
    ).alignments,
  ).toBe(0)
})

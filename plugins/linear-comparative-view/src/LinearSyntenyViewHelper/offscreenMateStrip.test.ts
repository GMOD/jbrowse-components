import {
  offscreenMateCount,
  offscreenMateHit,
  offscreenMateNavHit,
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

function source(over: Record<string, unknown> = {}) {
  return {
    level: 0,
    linearSyntenyDisplays: [{ featureData: { offscreenMates: mates(3) } }],
    parentView: {
      showOffscreenMates: true,
      bidirectionalFetch: false,
      minAlignmentLength: 0,
      overdrawPx: 1000,
      width: 800,
      views: [QUERY_ROW, TARGET_ROW],
    },
    ...over,
  }
}

// The mirror: alignments anchored on the row BELOW, whose query end is on a
// contig the row above is not displaying. Only a bidirectional fetch produces
// these, and they are placed against the lower row's own ruler — so the flag is
// part of the fixture rather than incidental to it: the lower strip is drawn
// only for a row the fetch went and asked about.
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
      bidirectionalFetch: true,
      minAlignmentLength: 0,
      overdrawPx: 1000,
      width: 800,
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
    side: 'bottom',
  })
})

test('a pointer at the top edge still answers the query axis', () => {
  expect(offscreenMateHit(withBand(bothSides()), 1, 1)).toEqual({
    refName: 'fromQuery',
    navRow: 1,
    side: 'top',
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
  expect(offscreenMateCount(both, 'other', 'top')).toBe(5)
})

// ...one lane at a time, named by the caller: the two hold contigs of different
// assemblies, so a refName alone does not say which tally it belongs to.
test('the count reads the lane it is asked for', () => {
  expect(offscreenMateCount(bothSides(), 'fromTarget', 'bottom')).toBe(1)
  expect(offscreenMateCount(bothSides(), 'fromTarget', 'top')).toBe(0)
})

test('a contig this band has nothing to say about counts zero', () => {
  expect(offscreenMateCount(source(), 'ctgQ', 'top')).toBe(0)
})

test('a display that has not fetched counts nothing rather than throwing', () => {
  expect(
    offscreenMateCount(source({ linearSyntenyDisplays: [{}] }), 'other', 'top'),
  ).toBe(0)
})

// The click's own resolver, which differs from the hover's only in carrying the
// coordinates — the strip it answers from, and the row that strip navigates,
// have to be the same ones or a click lands on a different axis from the mark
// the pointer was over.
test('a click resolves the same strip and row, plus the mate locus', () => {
  expect(offscreenMateNavHit(withBand(bothSides()), 1, 99)).toEqual({
    refName: 'fromTarget',
    navRow: 0,
    side: 'bottom',
    displayed: false,
    locus: { start: 0, end: 500 },
  })
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
        featureData: {
          offscreenMates: mates(0),
          targetOffscreenMates: mates(0),
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
  expect(offscreenMateHit(withBand(model), 1, 99)?.refName).toBe('scrolledAway')
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
            featureData: {
              offscreenMates: mates(0),
              targetOffscreenMates: mates(0),
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
        featureData: {
          offscreenMates: mates(0),
          targetOffscreenMates: mates(0),
        },
        culledRibbonMates: {
          onQueryAxis: culled('inBand', [0, 50]),
          onTargetAxis: culled('scrolledAway', [100_000, 100_050]),
        },
      },
    ],
  })
  expect(offscreenMateNavHit(withBand(model), 1, 99)).toMatchObject({
    refName: 'scrolledAway',
    navRow: 0,
    side: 'bottom',
    displayed: true,
  })
})

// A ZERO-WIDTH MATE SPAN IS STILL A PLACE. Dropped, the click fell back to the
// whole contig — the answer these coordinates exist to replace — and on this
// class of mark that fallback is `navToLocString`, which replaces the regions of
// the very row the mark says already has the contig. `displayed` and the locus
// therefore travel as a pair rather than as two optionals.
test('a mark whose mate span collapses still resolves to a place', () => {
  const point = { ...culled('scrolledAway', [100_000, 100_050]) }
  point.mateStarts = Float64Array.from([7_000])
  point.mateEnds = Float64Array.from([7_000])
  const model = bothSides({
    linearSyntenyDisplays: [
      {
        featureData: {
          offscreenMates: mates(0),
          targetOffscreenMates: mates(0),
        },
        culledRibbonMates: {
          onQueryAxis: culled('inBand', [0, 50]),
          onTargetAxis: point,
        },
      },
    ],
  })
  expect(offscreenMateNavHit(withBand(model), 1, 99)).toMatchObject({
    refName: 'scrolledAway',
    displayed: true,
    locus: { start: 7_000, end: 7_000 },
  })
})

// The ring, and why the lower strip waits. A culled target-axis mark is an
// alignment whose query end is off the row above, so a single fetch holds only
// the ones inside its pan buffer — the strip would stop at the fetch window's
// edge rather than at the data's, and step there as the upper row pans. The
// same model with the second query on draws it (above); with the query off it
// draws nothing rather than a fraction.
test('without the second query the lower strip draws nothing at all', () => {
  const model = bothSides({
    parentView: {
      showOffscreenMates: true,
      bidirectionalFetch: false,
      minAlignmentLength: 0,
      overdrawPx: 1000,
      width: 800,
      views: [QUERY_ROW, QUERY_ROW],
    },
    linearSyntenyDisplays: [
      {
        featureData: {
          offscreenMates: mates(0),
          targetOffscreenMates: mates(0),
        },
        culledRibbonMates: {
          onQueryAxis: culled('inBand', [0, 50]),
          onTargetAxis: culled('scrolledAway', [100_000, 100_050]),
        },
      },
    ],
  })
  expect(offscreenMateStrips(model)).toEqual([])
  expect(offscreenMateHit(withBand(model), 1, 99)).toBeUndefined()
})

// The count is the half of it that would be a wrong NUMBER rather than a
// missing mark, so it goes silent by the same gate and not by a second one.
test('an ungated lower lane is not counted either', () => {
  expect(offscreenMateCount(bothSides(), 'fromTarget', 'bottom')).toBe(1)
  expect(
    offscreenMateCount(
      bothSides({
        parentView: {
          showOffscreenMates: true,
          bidirectionalFetch: false,
          minAlignmentLength: 0,
          overdrawPx: 1000,
          width: 800,
          views: [QUERY_ROW, QUERY_ROW],
        },
      }),
      'fromTarget',
      'bottom',
    ),
  ).toBe(0)
})

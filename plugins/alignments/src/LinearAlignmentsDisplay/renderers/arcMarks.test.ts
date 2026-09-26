import { arcsToRegionResult } from '../../features/arcs/arcRegions.ts'
import { buildArcBandFeeds } from '../../features/arcs/bandFeed.ts'
import { ARC_SHAPE_ARC } from '../../features/arcs/shapes.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import { ARC_LINK_MARKS } from './arcMarks.ts'

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

// A pair whose radius is past the band's reach clamps its apex at the far
// edge, and the band clips there: the heaviest stroke's apex has to sit half
// its width inside, or the clip halves it.
function clampedDomeInk(down: boolean, width: number) {
  const band = { top: 20, height: 50, down }
  const feed = buildArcBandFeeds({
    byRegion: new Map([
      [
        0,
        arcsToRegionResult(
          [
            {
              p1: { refName: 'chr1', bp: 100 },
              p2: { refName: 'chr1', bp: 900 },
              colorType: 0,
              shapeType: ARC_SHAPE_ARC,
              yBp: 400,
              spanBp: 800,
              support: 1000,
              key: 'wide',
            },
          ],
          [],
        ),
      ],
    ]),
    crossRegion: [],
    displayed: [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ],
    colors: makeTestPalette(),
  }).get(0)!
  const state = {
    ...makeTestRenderState({
      canvasWidth: 1000,
      readConnectionsLineWidth: width,
      linkRegions: [{ anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 }],
    }),
    arcBand: band,
  }
  return { band, ink: ARC_LINK_MARKS[1]!.ink!(feed, block, state, 0)! }
}

test.each([
  [false, 1],
  [true, 1],
  [false, 2],
  [true, 2],
])(
  'a clamped dome keeps its apex stroke whole at the far edge (down %s, width %s)',
  (down, width) => {
    const { band, ink } = clampedDomeInk(down, width)
    const farInk = down ? ink.top + ink.height : ink.top
    const farEdge = down ? band.top + band.height : band.top
    expect(farInk).toBeCloseTo(farEdge, 6)
  },
)

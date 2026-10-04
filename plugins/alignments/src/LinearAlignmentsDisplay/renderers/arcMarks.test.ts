import { ARC_COLOR_INTERCHROM } from '../../features/arcs/arcColors.ts'
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
    colorField: 'insertSizeAndOrientation',
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

// An interchromosomal arc between two displayed regions has no genomic radius,
// so its dome is half as tall as its feet are apart, up to the band's reach.
function crossChromosomeInk(gapPx: number) {
  const band = { top: 20, height: 50, down: false }
  const feed = buildArcBandFeeds({
    colorField: 'insertSizeAndOrientation',
    byRegion: new Map(),
    crossRegion: [
      {
        p1: { refName: 'chr1', bp: 500 - gapPx / 2 },
        p2: { refName: 'chr2', bp: gapPx / 2 },
        colorType: ARC_COLOR_INTERCHROM,
        shapeType: ARC_SHAPE_ARC,
        yBp: 0,
        spanBp: 0,
        support: 1,
        key: 'join',
        p1RegionIndex: 0,
        p2RegionIndex: 1,
        p1Dir: 1,
        p2Dir: -1,
      },
    ],
    displayed: [
      { refName: 'chr1', start: 0, end: 500, displayedRegionIndex: 0 },
      { refName: 'chr2', start: 0, end: 500, displayedRegionIndex: 1 },
    ],
    colors: makeTestPalette(),
  }).get(0)!
  const state = {
    ...makeTestRenderState({
      canvasWidth: 1000,
      readConnectionsLineWidth: 1,
      linkRegions: [
        { anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 },
        { anchorPx: 500, anchorBp: 0, signedPxPerBp: 1 },
      ],
    }),
    arcBand: band,
  }
  return { band, ink: ARC_LINK_MARKS[2]!.ink!(feed, block, state, 0)! }
}

test('an interchromosomal arc across a seam is half as tall as its feet are apart', () => {
  const { band, ink } = crossChromosomeInk(40)
  const baseline = band.top + band.height
  expect(baseline - ink.top).toBeGreaterThan(20)
  expect(baseline - ink.top).toBeLessThan(25)
})

test('an interchromosomal arc wider than the band clamps inside its far edge', () => {
  const { band, ink } = crossChromosomeInk(400)
  expect(ink.top).toBeGreaterThanOrEqual(band.top)
  expect(ink.top).toBeLessThan(band.top + 3)
})

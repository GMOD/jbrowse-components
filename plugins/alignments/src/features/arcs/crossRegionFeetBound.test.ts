import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { ARC_COLOR_INTERCHROM } from '../../shaders/slang/arcLine.consts.generated.ts'
import { ARC_FOOT_PX } from './arcPath.ts'
import { computeCrossRegionArcs } from './crossRegionOverlay.ts'
import { ARC_SHAPE_ARC } from './shapes.ts'

import type { CrossRegionArc } from './arcTypes.ts'

// A foot lies over the sequence its junction keeps, so it stops where its own
// displayed region does: a breakend within a foot's length of a seam used to
// draw part of its tick across the seam, over a contig the junction says
// nothing about. Bounded per foot by that foot's region, never by the other
// foot — `arcFeetPath.test.ts` pins the merge two same-way feet must keep.

// Region 0 spans screen [0, 400), region 1 [400, 800): bp/10 within each.
const REGION_PX = 400
const bpToScreenX = (_refName: string, bp: number, regionIndex: number) =>
  bp / 10 + regionIndex * REGION_PX
const extents = [
  { left: 0, right: REGION_PX },
  { left: REGION_PX, right: 2 * REGION_PX },
]

function arc(bp1: number, bp2: number, p1Dir: number, p2Dir: number) {
  return {
    p1: { refName: 'ctgA', bp: bp1 },
    p2: { refName: 'ctgB', bp: bp2 },
    yBp: 500,
    shapeType: ARC_SHAPE_ARC,
    colorType: ARC_COLOR_INTERCHROM,
    support: 1,
    key: 'k',
    p1RegionIndex: 0,
    p2RegionIndex: 1,
    p1Dir,
    p2Dir,
  } as unknown as CrossRegionArc
}

function feetOf(d: string) {
  return [...d.matchAll(/M (-?[\d.]+) (-?[\d.]+) L (-?[\d.]+) \2/g)].map(m => ({
    from: Number(m[1]!),
    len: Number(m[3]!) - Number(m[1]!),
  }))
}

function draw(
  a: CrossRegionArc,
  regionScreenExtent = (i: number) => extents[i],
) {
  const [shape] = computeCrossRegionArcs({
    arcs: [a],
    bpToScreenX,
    frame: {
      arcsYDomainBp: 1000,
      arcsYLog: false,
      arcsTop: 0,
      arcsH: 100,
      pairedArcsDown: false,
      screenWidthPx: 800,
    },
    regionReversed: () => false,
    regionScreenExtent,
    lineWidth: 1,
    colors: makeTestPalette(),
  })
  return feetOf(shape!.d)
}

test('a foot with room draws its whole length', () => {
  // 100 px in from either edge of its region
  expect(draw(arc(1000, 3000, -1, 1))).toEqual([
    { from: 100, len: -ARC_FOOT_PX },
    { from: 700, len: ARC_FOOT_PX },
  ])
})

test('a foot pointing at a seam stops at it', () => {
  // The left foot sits 5 px before region 0's right edge and points into it;
  // the right foot sits 5 px past region 1's left edge and points back at it.
  expect(draw(arc(3950, 50, 1, -1))).toEqual([
    { from: 395, len: 5 },
    { from: 405, len: -5 },
  ])
})

test('a foot on the seam draws nothing, and the other foot is untouched', () => {
  expect(draw(arc(4000, 3000, 1, 1))).toEqual([{ from: 700, len: ARC_FOOT_PX }])
})

test('with no extent to read, the foot is unbounded', () => {
  expect(draw(arc(3950, 50, 1, -1), () => undefined)).toEqual([
    { from: 395, len: ARC_FOOT_PX },
    { from: 405, len: -ARC_FOOT_PX },
  ])
})

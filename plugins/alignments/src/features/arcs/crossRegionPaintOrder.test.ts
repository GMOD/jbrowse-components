import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { computeCrossRegionArcs } from './crossRegionOverlay.ts'

import type { CrossRegionArc } from './arcTypes.ts'

// Document order is paint order in an SVG overlay, and `pointerEvents: 'stroke'`
// hands the tooltip to the topmost path — so the order this returns decides both
// which arc a reader sees where two cross and which one they can ask about. It
// also decides what a cap keeps, since the cap takes the tail.
//
// This sorted on SUPPORT ALONE, under a comment claiming "nothing cross-region
// is routine". At a seam that is exactly backwards: cross-region arcs ARE the
// fragments straddling it, so at depth the set is overwhelmingly ordinary
// concordant pairs — `arcPaintRank`'s 9138-of-9204 ratio, reaching the overlay
// too. Two of them deep, a grey pair outranked the interchromosomal arc the
// two-region view was opened to look at.

const COLOR_ROUTINE = 0
const COLOR_SPLIT_INVERSION = 7

function arc(key: string, colorType: number, support: number): CrossRegionArc {
  return {
    p1: { refName: 'ctgA', bp: 1000 },
    p2: { refName: 'ctgB', bp: 2000 },
    colorType,
    shapeType: 0,
    yBp: 500,
    spanBp: 500,
    support,
    key,
    p1RegionIndex: 0,
    p2RegionIndex: 1,
    p1Dir: 1,
    p2Dir: -1,
  }
}

function draw(
  arcs: CrossRegionArc[],
  onCapped?: (d: number, k: number) => void,
) {
  return computeCrossRegionArcs({
    arcs,
    bpToScreenX: (_refName, bp, regionIndex) => bp / 10 + regionIndex * 400,
    frame: {
      arcsYDomainBp: 1000,
      arcsYLog: false,
      arcsTop: 0,
      arcsH: 100,
      pairedArcsDown: false,
      screenWidthPx: 800,
    },
    regionReversed: () => false,
    lineWidth: 1,
    colors: makeTestPalette(),
    onCapped,
  })
}

test('a categorized arc paints over a heavier routine one', () => {
  const drawn = draw([
    arc('categorized', COLOR_SPLIT_INVERSION, 1),
    arc('routine', COLOR_ROUTINE, 3),
  ])
  expect(drawn.map(a => a.key)).toEqual(['routine', 'categorized'])
})

test('and the cap keeps it, however deep the routine arcs are', () => {
  // 601 routine arcs is one past `CROSS_REGION_ARC_CAP`, which is where the cap
  // starts choosing. Each is FIVE reads deep against the categorized arc's one,
  // so a support-only ranking put the categorized arc first and the cap — which
  // takes the tail — dropped it before anything else.
  const routine = Array.from({ length: 601 }, (_, i) =>
    arc(`routine${i}`, COLOR_ROUTINE, 5),
  )
  let dropped = 0
  const drawn = draw(
    [arc('categorized', COLOR_SPLIT_INVERSION, 1), ...routine],
    d => {
      dropped = d
    },
  )
  expect(dropped).toBe(2)
  expect(drawn.map(a => a.key)).toContain('categorized')
  // and it is still the last path, so it is also the one a hover resolves to
  expect(drawn.at(-1)!.key).toBe('categorized')
})

import { ARC_HIT_SLOP_PX } from '@jbrowse/sv-core'

import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { computeCrossRegionArcs } from './crossRegionOverlay.ts'

import type { CrossRegionArc } from './arcTypes.ts'

// A cross-region arc is hovered by SVG rather than by `hitTestArcBand`, and an
// SVG path with `pointerEvents: 'stroke'` answers on its own ink and nothing
// more. So these arcs had a target as wide as their stroke — ONE pixel at the
// default `readConnectionsLineWidth` — while every arc inside a region got
// `ARC_HIT_SLOP_PX` either side of its own. They are the arcs a two-region view
// is opened for (every interchromosomal arc is one), so the band's hardest marks
// to hover were the ones most worth hovering.
//
// The target is a second, transparent path stroked at `hitStrokeWidth`. This
// holds it against the canvas band's tolerance rather than against a remembered
// number, so the two families cannot drift apart.

function arc(support: number): CrossRegionArc {
  return {
    p1: { refName: 'ctgA', bp: 1000 },
    p2: { refName: 'ctgB', bp: 2000 },
    colorType: 0,
    shapeType: 0,
    yBp: 500,
    spanBp: 500,
    support,
    key: `k${support}`,
    p1RegionIndex: 0,
    p2RegionIndex: 1,
    p1Dir: 1,
    p2Dir: -1,
  }
}

function draw(arcs: CrossRegionArc[], lineWidth: number) {
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
    regionScreenExtent: () => undefined,
    lineWidth,
    colors: makeTestPalette(),
  })
}

test('the hover target is the canvas band tolerance around the drawn ink', () => {
  for (const lineWidth of [0.5, 1, 3]) {
    for (const support of [1, 4, 200]) {
      const [shape] = draw([arc(support)], lineWidth)
      expect(shape!.strokeWidth).toBe(arcLineWidth(support, lineWidth))
      expect(shape!.hitStrokeWidth).toBe(
        shape!.strokeWidth + 2 * ARC_HIT_SLOP_PX,
      )
    }
  }
})

// The target grows with the ink rather than being one fixed hitbox, which is the
// property `ARC_HIT_SLOP_PX` is documented on: a heavily-supported arc draws a
// wider mark and should answer over the whole of it.
test('a heavier arc has a wider target than a lighter one', () => {
  const [light] = draw([arc(1)], 1)
  const [heavy] = draw([arc(64)], 1)
  expect(heavy!.hitStrokeWidth).toBeGreaterThan(light!.hitStrokeWidth)
})

// The endpoint squares have no hover of their own, in EITHER renderer, and the
// arithmetic that makes that safe is the same one `hitTest.test.ts` pins for the
// canvas: a square is inside the tolerance of the bar it sits on. If the target
// ever stops being at least the marker's half-width, the read cloud's connectors
// lose their squares to the gap.
test('the target covers an endpoint square', () => {
  const [shape] = draw([{ ...arc(1), shapeType: 1 }], 1)
  const marker = shape!.markers![0]!
  expect(shape!.hitStrokeWidth / 2).toBeGreaterThanOrEqual(marker.height / 2)
})

import { ARC_SHAPE_ARC } from '../../features/arcs/compute.ts'
import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import { resolveArcBandHover } from './arcHitTest.ts'

import type { ArcHitBandOptions } from './arcHitTest.ts'

// One arc, mates at 1200 and 1600 bp, 40bp of apex.
const ARCS = {
  ...emptyArcsUploadData(),
  arcX1: new Uint32Array([1200]),
  arcX2: new Uint32Array([1600]),
  arcYBp: new Uint32Array([40]),
  arcSupport: new Uint32Array([7]),
  arcShapeTypes: new Uint8Array([ARC_SHAPE_ARC]),
  arcColorTypes: new Uint8Array([0]),
  numArcs: 1,
}

// 1000bp across 1000px, so a bp is a px and every expected coordinate below is
// readable: the mates land at x=200 and x=600.
const REGION = {
  start: 1000,
  end: 2000,
  screenStartPx: 0,
  screenEndPx: 1000,
}

const OPTS = {
  region: REGION,
  band: { arcBandTop: 0, arcBandHeight: 100, arcDown: false },
  scroll: { isGrouped: false, scrollTop: 0, canvasHeight: 500 },
  lineWidth: 1,
  arcsYDomainBp: undefined,
  canvasWidthPx: 1000,
} satisfies ArcHitBandOptions

// The apex of that arc in the default band: availH is 100 - ARC_HEIGHT_MARGIN,
// the linear arc-mode domain makes 40bp of yBp exactly 40px of rise, and the
// dome peaks at ARC_APEX_FRACTION of it.
const APEX = { x: 400, y: 100 - 0.75 * 40 }

test('finds the arc at its apex, and carries the support count out', () => {
  const hover = resolveArcBandHover(APEX.x, APEX.y, ARCS, OPTS)
  expect(hover?.hit.index).toBe(0)
  expect(hover?.hit.support).toBe(7)
  expect([hover?.hit.x1, hover?.hit.x2]).toEqual([1200, 1600])
})

test('an ungrouped band is sticky, so scrolling does not move it', () => {
  // Only the pileup content scrolls under an ungrouped display's bands, which is
  // the tier `bandScreenTop` encodes. The apex must stay where it was.
  const scrolled = {
    ...OPTS,
    scroll: { isGrouped: false, scrollTop: 40, canvasHeight: 500 },
  }
  expect(resolveArcBandHover(APEX.x, APEX.y, ARCS, scrolled)?.hit.index).toBe(0)
})

test('a grouped band scrolls with its section', () => {
  const scroll = { isGrouped: true, scrollTop: 40, canvasHeight: 500 }
  // Band top 40 minus scroll 40 puts the band back at the top of the canvas, so
  // the apex is at the same screen y the unscrolled ungrouped case had.
  const hover = resolveArcBandHover(APEX.x, APEX.y, ARCS, {
    ...OPTS,
    band: { arcBandTop: 40, arcBandHeight: 100, arcDown: false },
    scroll,
  })
  expect(hover?.hit.index).toBe(0)
  // Without the scroll subtraction the band would sit 40px lower, and the same
  // point would be off the arc — this is the assertion that the projection is
  // applied at all.
  expect(
    resolveArcBandHover(APEX.x, APEX.y, ARCS, {
      ...OPTS,
      band: { arcBandTop: 40, arcBandHeight: 100, arcDown: false },
      scroll: { ...scroll, scrollTop: 0 },
    }),
  ).toBeUndefined()
})

test('a reversed region mirrors the arc onto the other side of the block', () => {
  const reversed = { ...OPTS, region: { ...REGION, reversed: true } }
  // bp 1200 and 1600 now map to x=800 and x=400, so the dome centres on 600.
  expect(resolveArcBandHover(600, APEX.y, ARCS, reversed)?.hit.index).toBe(0)
  // …and no longer answers where the forward-strand dome peaked.
  expect(resolveArcBandHover(400, APEX.y, ARCS, reversed)).toBeUndefined()
})

test('a lane that reserved no arc band answers nothing', () => {
  // `arcBandHeight` 0 is the same gate the renderers use to skip the pass — a
  // group whose reads produced no arc, or arcs switched off entirely.
  expect(
    resolveArcBandHover(APEX.x, APEX.y, ARCS, {
      ...OPTS,
      band: { arcBandTop: 0, arcBandHeight: 0, arcDown: false },
    }),
  ).toBeUndefined()
  expect(resolveArcBandHover(APEX.x, APEX.y, undefined, OPTS)).toBeUndefined()
  expect(
    resolveArcBandHover(APEX.x, APEX.y, emptyArcsUploadData(), OPTS),
  ).toBeUndefined()
})

// `arcIsFar` is `2 * halfWidth > canvasW`, and `canvasW` is the BLOCK's clamped
// width (`scissorW`) on both renderers, not the canvas's. Feeding the hit test
// the full canvas width put it on the other side of that test from the paint
// for every block narrower than the canvas — which is every multi-region view.
describe('the far/near split is taken against the same width the renderers use', () => {
  // A 400px block on a 1000px canvas, still 1bp per px. The mate at 1700 is off
  // the block's right edge, which is exactly the case the projection is built to
  // extrapolate through — so the pair spans 600px: far against the block's 400,
  // near against the canvas's 1000.
  const NARROW = {
    region: { start: 1000, end: 1400, screenStartPx: 0, screenEndPx: 400 },
    band: { arcBandTop: 0, arcBandHeight: 100, arcDown: false },
    scroll: { isGrouped: false, scrollTop: 0, canvasHeight: 500 },
    lineWidth: 1,
    arcsYDomainBp: undefined,
    canvasWidthPx: 1000,
  } satisfies ArcHitBandOptions
  const WIDE_PAIR = {
    ...ARCS,
    arcX1: new Uint32Array([1100]),
    arcX2: new Uint32Array([1700]),
  }

  // What the renderers paint: a circle of radius halfWidth (300) centred on the
  // span's midpoint at the anchor line, whose apex is 300px above a 100px band —
  // so only two near-vertical legs are inside it. 20px up the left leg:
  const LEG = { x: 400 - Math.sqrt(300 * 300 - 20 * 20), y: 100 - 20 }

  test('a leg of the painted semicircle answers', () => {
    expect(
      resolveArcBandHover(LEG.x, LEG.y, WIDE_PAIR, NARROW)?.hit.index,
    ).toBe(0)
  })

  test('and the dome the canvas-width reading would have drawn does not', () => {
    // Read as a near pair the same arc is an ellipse peaking 30px up at x=400,
    // which is where the hover used to answer. Nothing is painted there — the
    // real curve is 200px above the band at that x — so it must miss.
    expect(
      resolveArcBandHover(400, 100 - 30, WIDE_PAIR, NARROW),
    ).toBeUndefined()
  })
})

test('a degenerate region does not divide by zero', () => {
  // A region measured before layout has zero width; the projection is undefined
  // there rather than infinite, so the hover simply misses.
  expect(
    resolveArcBandHover(APEX.x, APEX.y, ARCS, {
      ...OPTS,
      region: { ...REGION, screenEndPx: 0 },
    }),
  ).toBeUndefined()
})

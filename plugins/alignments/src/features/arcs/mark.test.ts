import { arcScreenPath } from './arcPath.ts'
import { strokeArcMark } from './drawCanvas.ts'
import { hitTestArcBand } from './hitTest.ts'
import { arcMark } from './mark.ts'
import { ARC_SHAPE_ARC, ARC_SHAPE_FLAT } from './shapes.ts'
import { emptyArcsUploadData } from './types.ts'

import type { ArcHitOptions } from './hitTest.ts'
import type { ArcsUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// One frame, handed to all three consumers, so a divergence between them is a
// failure here rather than something only a screenshot would show.
const FRAME = {
  arcsTop: 0,
  arcsH: 100,
  pairedArcsDown: false,
  lineWidth: 1,
  screenWidthPx: 1000,
  // Read-cloud style: an autoscaled |tlen| domain read on a log axis. A yBp far
  // past the domain is the interesting case, because that is where the clamp
  // decides the apex.
  arcsYDomainBp: 500,
  arcsYLog: true,
  bpToScreenX: (bp: number) => bp,
} satisfies ArcHitOptions

function arcsData(
  arcs: { x1: number; x2: number; yBp: number; shape?: number }[],
): ArcsUploadData {
  return {
    ...emptyArcsUploadData(),
    arcX1: new Uint32Array(arcs.map(a => a.x1)),
    arcX2: new Uint32Array(arcs.map(a => a.x2)),
    arcYBp: new Uint32Array(arcs.map(a => a.yBp)),
    arcSpanBp: new Uint32Array(arcs.map(a => a.yBp)),
    arcSupport: new Uint32Array(arcs.map(() => 1)),
    arcShapeTypes: new Uint8Array(arcs.map(a => a.shape ?? ARC_SHAPE_ARC)),
    arcColorTypes: new Uint8Array(arcs.map(() => 0)),
    numArcs: arcs.length,
  }
}

// The ellipse `strokeArcMark` hands Canvas2D when the DRAW resolves this arc —
// off the mark itself, not a height the test picked. An earlier version of this
// check passed its own in, which is why it kept passing while the highlight was
// reading a different Y for a dome.
function drawnEllipse(data: ArcsUploadData, i: number, opts: ArcHitOptions) {
  const mark = arcMark(data, i, opts)
  if (mark.kind !== 'dome') {
    throw new Error('expected a dome')
  }
  let call: { cx: number; cy: number; rx: number; ry: number } | undefined
  const ctx = {
    beginPath: () => {},
    stroke: () => {},
    ellipse: (cx: number, cy: number, rx: number, ry: number) => {
      call = { cx, cy, rx, ry }
    },
  } as unknown as Ctx2D
  strokeArcMark(ctx, mark)
  return call!
}

// Points on that ellipse, at the angles strokeArcMark sweeps — INSIDE the band
// only. Both renderers clip the arc pass to it and `hitTestArcBand` gates on it
// exactly, so a sample above the band is not ink and asserting a hit there
// would assert the opposite of what the band does. A tall dome's in-band part
// is the two near-vertical legs by its feet.
function inBandPointsOnDrawnCurve(data: ArcsUploadData, opts: ArcHitOptions) {
  const e = drawnEllipse(data, 0, opts)
  const [start, end] = opts.pairedArcsDown
    ? [0, Math.PI]
    : [Math.PI, 2 * Math.PI]
  const pts = Array.from({ length: 41 }, (_, k) => {
    const t = start + (k / 40) * (end - start)
    return { x: e.cx + e.rx * Math.cos(t), y: e.cy + e.ry * Math.sin(t) }
  }).filter(p => p.y >= opts.arcsTop && p.y <= opts.arcsTop + opts.arcsH)
  expect(pts.length).toBeGreaterThan(0)
  return pts
}

// A dome whose yBp is far past the band's domain, so the clamp is what places
// its apex. Every consumer must agree on where that landed.
const TALL_DOME = arcsData([{ x1: 200, x2: 600, yBp: 100_000 }])

test('the dome the draw places is the one the hit test answers on', () => {
  for (const p of inBandPointsOnDrawnCurve(TALL_DOME, FRAME)) {
    expect(hitTestArcBand(p.x, p.y, TALL_DOME, FRAME)?.index).toBe(0)
  }
})

test('and the one the highlight traces', () => {
  const e = drawnEllipse(TALL_DOME, 0, FRAME)
  expect(arcScreenPath(TALL_DOME, 0, FRAME)).toBe(
    `M ${e.cx - e.rx} ${e.cy} A ${e.rx} ${e.ry} 0 0 1 ${e.cx + e.rx} ${e.cy}`,
  )
})

test('a dome past the domain still closes inside the band', () => {
  // The property the clamp exists for: however far past the domain yBp runs,
  // the apex stays within the band, so a pair with both endpoints on screen
  // draws a complete arc BETWEEN them instead of leaving through the band edge.
  // Unclamping this (98dd82120b) is what turned wide domes into two clipped
  // flanks; the flat mark shares the rule, so both land at the same ceiling.
  const flat = arcsData([
    { x1: 200, x2: 600, yBp: 100_000, shape: ARC_SHAPE_FLAT },
  ])
  const bar = arcMark(flat, 0, FRAME)
  const dome = arcMark(TALL_DOME, 0, FRAME)
  expect(dome.destY).toBeLessThanOrEqual(FRAME.arcsH)
  // The two kinds differ in SHAPE, not in height: one clamped `destY` places
  // both. (A dome has no `markY` to compare — the field is the bar's, because
  // for a curve it named a point on no drawn arc.)
  expect(dome.destY).toBe(bar.destY)
})

test('a down-pointing band mirrors every consumer at once', () => {
  const down = { ...FRAME, pairedArcsDown: true }
  for (const p of inBandPointsOnDrawnCurve(TALL_DOME, down)) {
    expect(hitTestArcBand(p.x, p.y, TALL_DOME, down)?.index).toBe(0)
  }
  const e = drawnEllipse(TALL_DOME, 0, down)
  expect(arcScreenPath(TALL_DOME, 0, down)).toBe(
    `M ${e.cx - e.rx} ${e.cy} A ${e.rx} ${e.ry} 0 0 0 ${e.cx + e.rx} ${e.cy}`,
  )
})

test('a band shorter than the apex margin collapses instead of inverting', () => {
  // `readConnectionsHeight` is a plain config slot, so a band under
  // ARC_HEIGHT_MARGIN is reachable without any drag. It used to make the
  // plottable height negative, and every consumer took that at face value: this
  // dome's `ry` came out negative, and `ctx.ellipse` throws on a negative
  // radius. The floor is `arcAvailH`'s, so both kinds collapse onto the anchor
  // rather than each guarding its own arithmetic.
  const tiny = { ...FRAME, arcsTop: 0, arcsH: 5 }
  const dome = arcMark(TALL_DOME, 0, tiny)
  expect(dome.destY).toBe(0)
  expect(dome.kind === 'dome' && dome.ry).toBe(0)
  const bar = arcMark(
    arcsData([{ x1: 200, x2: 600, yBp: 100_000, shape: ARC_SHAPE_FLAT }]),
    0,
    tiny,
  )
  // The anchor is the band's bottom edge here, and a collapsed band puts the
  // mark on it.
  expect(bar.kind === 'bar' && bar.markY).toBe(tiny.arcsH)
})

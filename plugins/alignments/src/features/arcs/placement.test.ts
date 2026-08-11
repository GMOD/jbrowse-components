import { arcScreenPath } from './arcPath.ts'
import { ARC_SHAPE_ARC, ARC_SHAPE_FLAT } from './compute.ts'
import { strokeArc } from './drawCanvas.ts'
import { hitTestArcs } from './hitTest.ts'
import { arcPlacement } from './placement.ts'
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
  // Read-cloud style: an autoscaled |tlen| domain read on a log axis. This is
  // the mode where the clamped/unclamped Y split bites, because a yBp past the
  // domain is what `arcYOffsetPx` clamps and `arcDomeDestY` does not.
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
    arcSupport: new Uint32Array(arcs.map(() => 1)),
    arcShapeTypes: new Uint8Array(arcs.map(a => a.shape ?? ARC_SHAPE_ARC)),
    arcColorTypes: new Uint8Array(arcs.map(() => 0)),
    numArcs: arcs.length,
  }
}

// The ellipse `strokeArc` hands Canvas2D when the DRAW places this arc — with
// the apex `arcPlacement` resolved, not one the test picked. An earlier version
// of this check passed its own apexY in, which is why it kept passing while the
// highlight was reading the clamped Y for a dome.
function drawnEllipse(data: ArcsUploadData, i: number, opts: ArcHitOptions) {
  const { sx1, sx2, anchorY, apexY } = arcPlacement(data, i, opts)
  let call: { cx: number; cy: number; rx: number; ry: number } | undefined
  const ctx = {
    beginPath: () => {},
    stroke: () => {},
    ellipse: (cx: number, cy: number, rx: number, ry: number) => {
      call = { cx, cy, rx, ry }
    },
  } as unknown as Ctx2D
  strokeArc(
    ctx,
    sx1,
    sx2,
    anchorY,
    apexY,
    opts.pairedArcsDown,
    opts.screenWidthPx,
  )
  return call!
}

// Points on that ellipse, at the angles strokeArc sweeps — INSIDE the band
// only. Both renderers clip the arc pass to it and `hitTestArcs` gates on it
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

// A dome whose yBp is far past the band's domain — the case `arcDomeDestY`
// exists for, and the one where reading the clamped `arcYOffsetPx` instead puts
// the apex on the band's ceiling rather than above it.
const TALL_DOME = arcsData([{ x1: 200, x2: 600, yBp: 100_000 }])

test('the dome the draw places is the one the hit test answers on', () => {
  for (const p of inBandPointsOnDrawnCurve(TALL_DOME, FRAME)) {
    expect(hitTestArcs(p.x, p.y, TALL_DOME, FRAME)?.index).toBe(0)
  }
})

test('and the one the highlight traces', () => {
  const e = drawnEllipse(TALL_DOME, 0, FRAME)
  expect(arcScreenPath(TALL_DOME, 0, FRAME)).toBe(
    `M ${e.cx - e.rx} ${e.cy} A ${e.rx} ${e.ry} 0 0 1 ${e.cx + e.rx} ${e.cy}`,
  )
})

test('a clamped flat mark stays inside the band the dome leaves', () => {
  // Same yBp, flat shape. The clamp is the whole difference between the two
  // rules, so a placement that used one for both would put these at one Y.
  const flat = arcsData([
    { x1: 200, x2: 600, yBp: 100_000, shape: ARC_SHAPE_FLAT },
  ])
  const bar = arcPlacement(flat, 0, FRAME)
  const dome = arcPlacement(TALL_DOME, 0, FRAME)
  expect(bar.apexY).toBeGreaterThanOrEqual(FRAME.arcsTop)
  expect(dome.apexY).toBeLessThan(bar.apexY)
})

test('a down-pointing band mirrors every consumer at once', () => {
  const down = { ...FRAME, pairedArcsDown: true }
  for (const p of inBandPointsOnDrawnCurve(TALL_DOME, down)) {
    expect(hitTestArcs(p.x, p.y, TALL_DOME, down)?.index).toBe(0)
  }
  const e = drawnEllipse(TALL_DOME, 0, down)
  expect(arcScreenPath(TALL_DOME, 0, down)).toBe(
    `M ${e.cx - e.rx} ${e.cy} A ${e.rx} ${e.ry} 0 0 0 ${e.cx + e.rx} ${e.cy}`,
  )
})

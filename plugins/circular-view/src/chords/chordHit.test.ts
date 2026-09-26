import { chordControlPoint } from './chordGeometry.ts'
import { chordDistanceSq, CHORD_HIT_PX, ribbonContains } from './chordHit.ts'
import { canvasPathSink } from './pathSink.ts'
import { traceRibbon } from './ribbonGeometry.ts'

import type { RibbonAngles } from './chordStage.ts'

const RADIUS = 200
const BEZIER = 20
const SIZE = 500
const CENTRE = SIZE / 2

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// jsdom draws through node-canvas, which takes isPointInPath's point in user
// space: with the identity in place that is the canvas's own pixels
function canvasFill(angles: RibbonAngles) {
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.canvas.width = SIZE
  ctx.canvas.height = SIZE
  ctx.translate(CENTRE, CENTRE)
  ctx.beginPath()
  traceRibbon(canvasPathSink(ctx), angles, RADIUS, BEZIER)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return (x: number, y: number) => ctx.isPointInPath(CENTRE + x, CENTRE + y)
}

function randomRibbon(rand: () => number): RibbonAngles {
  const span = () => 0.01 + rand() * 0.6
  const a1 = rand() * 2 * Math.PI - Math.PI
  const a2 = a1 + (rand() < 0.5 ? 1 : -1) * span()
  const m = rand() * 2 * Math.PI - Math.PI
  const w = (rand() < 0.5 ? 1 : -1) * span()
  return { a1, a2, m1: m, m2: m + w }
}

// Away from the outline, where a pixel's worth of rounding cannot decide it, the
// winding test and the canvas's own fill of the painter's path agree on every
// point: forward and reverse, arcs either side of the first angle, a span wider
// than the other
test('a point is inside a ribbon exactly where the canvas fills it', () => {
  const rand = mulberry32(7)
  let compared = 0
  for (let r = 0; r < 60; r++) {
    const angles = randomRibbon(rand)
    const inFill = canvasFill(angles)
    for (let k = 0; k < 150; k++) {
      const x = (rand() * 2 - 1) * (RADIUS + 10)
      const y = (rand() * 2 - 1) * (RADIUS + 10)
      const here = inFill(x, y)
      const settled = [
        [0.6, 0],
        [-0.6, 0],
        [0, 0.6],
        [0, -0.6],
      ].every(([dx, dy]) => inFill(x + dx!, y + dy!) === here)
      if (settled) {
        compared++
        expect([r, k, ribbonContains(x, y, angles, RADIUS, BEZIER)]).toEqual([
          r,
          k,
          here,
        ])
      }
    }
  }
  expect(compared).toBeGreaterThan(8000)
})

test('a twisted ribbon covers both of its lobes', () => {
  // a reverse alignment between two spans opposite each other
  const angles = { a1: -0.3, a2: 0.3, m1: Math.PI - 0.3, m2: Math.PI + 0.3 }
  const inFill = canvasFill(angles)
  const nearAnchor = [RADIUS - 5, 0] as const
  const nearMate = [-(RADIUS - 5), 0] as const
  expect(inFill(...nearAnchor)).toBe(true)
  expect(inFill(...nearMate)).toBe(true)
  expect(ribbonContains(...nearAnchor, angles, RADIUS, BEZIER)).toBe(true)
  expect(ribbonContains(...nearMate, angles, RADIUS, BEZIER)).toBe(true)
})

describe('a chord', () => {
  const ends = { startRadians: 0.2, endRadians: 2.6 }
  const [cx, cy] = chordControlPoint({
    ...ends,
    radius: RADIUS,
    bezierRadius: BEZIER,
  })
  const x0 = RADIUS * Math.cos(ends.startRadians)
  const y0 = RADIUS * Math.sin(ends.startRadians)
  const x1 = RADIUS * Math.cos(ends.endRadians)
  const y1 = RADIUS * Math.sin(ends.endRadians)
  // the curve's midpoint, and the unit normal there
  const mx = 0.25 * x0 + 0.5 * cx + 0.25 * x1
  const my = 0.25 * y0 + 0.5 * cy + 0.25 * y1
  const tx = x1 - x0
  const ty = y1 - y0
  const len = Math.hypot(tx, ty)
  const [nx, ny] = [-ty / len, tx / len]
  const at = (d: number) =>
    chordDistanceSq(
      mx + nx * d,
      my + ny * d,
      ends,
      RADIUS,
      BEZIER,
      CHORD_HIT_PX,
    )

  test('measures the distance from its curve', () => {
    expect(Math.sqrt(at(0))).toBeLessThan(0.05)
    expect(Math.sqrt(at(2))).toBeCloseTo(2, 1)
  })

  test('is out of reach past its hull', () => {
    expect(at(40)).toBe(Infinity)
  })
})

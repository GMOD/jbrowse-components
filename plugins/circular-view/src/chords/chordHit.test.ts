import { chordControlPoint } from './chordGeometry.ts'
import {
  chordDistanceSq,
  CHORD_HIT_PX,
  hitRibbon,
  ribbonContains,
  ribbonHitGeometry,
  ribbonHitTest,
} from './chordHit.ts'
import { ribbonAnglesAt } from './chordStage.ts'
import { canvasPathSink } from './pathSink.ts'
import { traceRibbon } from './ribbonGeometry.ts'

import type { ChordStage, RibbonAngles, RibbonLanes } from './chordStage.ts'

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

function randomRibbon(rand: () => number, maxSpan: number): RibbonAngles {
  const span = () => 0.01 + rand() * maxSpan
  const a1 = rand() * 2 * Math.PI - Math.PI
  const a2 = a1 + (rand() < 0.5 ? 1 : -1) * span()
  const m = rand() * 2 * Math.PI - Math.PI
  const w = (rand() < 0.5 ? 1 : -1) * span()
  return { a1, a2, m1: m, m2: m + w }
}

// Away from the outline, where a pixel's worth of rounding cannot decide it, the
// winding test and the canvas's own fill of the painter's path agree on every
// point: forward and reverse, arcs either side of the first angle, a span wider
// than the other, and a span past half the circle, which turns in y twice.
// node-canvas counts half a pixel past the rim as filled, so the rim's pixel
// either side is left out
test.each([
  ['spans up to 0.6 rad', 7, 0.6, 8000],
  ['spans past half the circle', 3, 5.5, 5000],
])(
  'a point is inside a ribbon exactly where the canvas fills it: %s',
  (_, seed, maxSpan, least) => {
    const rand = mulberry32(seed)
    let compared = 0
    for (let r = 0; r < 60; r++) {
      const angles = randomRibbon(rand, maxSpan)
      const inFill = canvasFill(angles)
      for (let k = 0; k < 150; k++) {
        const x = (rand() * 2 - 1) * (RADIUS + 10)
        const y = (rand() * 2 - 1) * (RADIUS + 10)
        const here = inFill(x, y)
        const settled =
          Math.abs(Math.hypot(x, y) - RADIUS) > 1 &&
          [
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
    expect(compared).toBeGreaterThan(least)
  },
)

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

// a thousand bp to the radian, every foot on one slice
const STAGE: ChordStage = {
  radiansPerBp: 1e-3,
  gapRadians: 0,
  offsetRadians: 0.4,
  radiusPx: RADIUS,
  bezierRadiusPx: BEZIER,
}

function randomLanes(rand: () => number, n: number): RibbonLanes {
  const turnBp = (2 * Math.PI) / STAGE.radiansPerBp
  const lanes: RibbonLanes = {
    x1: new Float32Array(n),
    x2: new Float32Array(n),
    y1: new Float32Array(n),
    y2: new Float32Array(n),
    xSlice: new Uint32Array(n),
    ySlice: new Uint32Array(n),
    strand: new Float32Array(n),
    color: new Uint32Array(n),
    count: n,
    features: [],
  }
  const spanBp = () => rand() * 0.6 * 1000
  for (let i = 0; i < n; i++) {
    lanes.x1[i] = rand() * turnBp
    lanes.x2[i] = lanes.x1[i]! + spanBp()
    lanes.y1[i] = rand() * turnBp
    lanes.y2[i] = lanes.y1[i]! + spanBp()
    lanes.strand[i] = rand() < 0.5 ? -1 : 1
  }
  return lanes
}

function topmostByScan(
  lanes: RibbonLanes,
  stage: ChordStage,
  x: number,
  y: number,
) {
  for (let i = lanes.count - 1; i >= 0; i--) {
    const angles = ribbonAnglesAt(lanes, i, stage)
    if (ribbonContains(x, y, angles, stage.radiusPx, stage.bezierRadiusPx)) {
      return i
    }
  }
  return undefined
}

// the rim's four extremes, where an arc bulges past both its ends, and a
// scatter over the disc
function probePoints(rand: () => number) {
  const points: [number, number][] = []
  for (let k = 0; k < 4; k++) {
    for (const inset of [0.2, 1, 3]) {
      for (const nudge of [-0.01, 0, 0.01]) {
        const a = (k * Math.PI) / 2 + nudge
        points.push([
          (RADIUS - inset) * Math.cos(a),
          (RADIUS - inset) * Math.sin(a),
        ])
      }
    }
  }
  for (let k = 0; k < 3000; k++) {
    const r = RADIUS * Math.sqrt(rand())
    const a = rand() * 2 * Math.PI
    points.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return points
}

// Each ribbon's box only skips the winding test where it would say no, so the
// topmost ribbon found through the boxes is the one a scan of every fill finds
test('the boxes change no hit', () => {
  const rand = mulberry32(11)
  const lanes = randomLanes(rand, 120)
  const geometry = ribbonHitGeometry(lanes, STAGE)
  let hits = 0
  for (const [x, y] of probePoints(rand)) {
    const expected = topmostByScan(lanes, STAGE, x, y)
    hits += expected === undefined ? 0 : 1
    expect([x, y, hitRibbon(lanes, STAGE, geometry, x, y)]).toEqual([
      x,
      y,
      expected,
    ])
  }
  expect(hits).toBeGreaterThan(1500)
})

test('a turn or new lanes measure the boxes again', () => {
  const rand = mulberry32(5)
  const lanes = randomLanes(rand, 40)
  const hitTest = ribbonHitTest()
  const turned = { ...STAGE, offsetRadians: STAGE.offsetRadians + 1.3 }
  const moved = randomLanes(rand, 40)
  let differs = 0
  for (const [x, y] of probePoints(rand).slice(0, 600)) {
    const here = hitTest(lanes, STAGE, x, y)
    expect(here).toBe(topmostByScan(lanes, STAGE, x, y))
    expect(hitTest(lanes, turned, x, y)).toBe(
      topmostByScan(lanes, turned, x, y),
    )
    expect(hitTest(moved, STAGE, x, y)).toBe(topmostByScan(moved, STAGE, x, y))
    differs += here === topmostByScan(lanes, turned, x, y) ? 0 : 1
  }
  expect(differs).toBeGreaterThan(100)
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

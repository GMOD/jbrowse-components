import { arcApexY, arcDistancePx, arcPathD, arcStroke } from './arcShape.ts'

import type { ArcShape } from './arcShape.ts'

const semicircle = (left: number, right: number): ArcShape => ({
  kind: 'semicircle',
  left,
  right,
})

// The emitted `d` is read the way a renderer reads it: SVG's F.6.5 endpoint →
// center parameterization, then the points it actually puts on screen. Asserting
// on the string instead would only restate the template — the flag whose value
// is in question is one character of it, and its meaning lives entirely in this
// conversion.
function arcPoints(d: string, samples = 64) {
  const m =
    /^M (\S+) (\S+) A (\S+) (\S+) 0 (\d) (\d) (\S+) (\S+)$/.exec(d) ??
    (() => {
      throw new Error(`not a single-arc path: ${d}`)
    })()
  const [x1, y1, rx0, ry0, fA, fS, x2, y2] = m.slice(1).map(Number)

  const dx = (x1! - x2!) / 2
  const dy = (y1! - y2!) / 2
  let rx = Math.abs(rx0!)
  let ry = Math.abs(ry0!)
  const lambda = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }

  const num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx
  const den = rx * rx * dy * dy + ry * ry * dx * dx
  const coef = (fA === fS ? -1 : 1) * Math.sqrt(Math.max(0, num / den))
  const cxp = (coef * (rx * dy)) / ry
  const cyp = (coef * -(ry * dx)) / rx
  const cx = cxp + (x1! + x2!) / 2
  const cy = cyp + (y1! + y2!) / 2

  const ux = (dx - cxp) / rx
  const uy = (dy - cyp) / ry
  const vx = (-dx - cxp) / rx
  const vy = (-dy - cyp) / ry
  const theta1 = Math.atan2(uy, ux)
  let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  if (fS === 0 && delta > 0) {
    delta -= 2 * Math.PI
  }
  if (fS === 1 && delta < 0) {
    delta += 2 * Math.PI
  }

  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = theta1 + (delta * i) / samples
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }
  })
}

// y grows downward in SVG, so the whole arc must sit at y >= 0 — the container
// clips at the display's own height and there is nothing above the baseline.
function apexY(d: string) {
  return Math.max(...arcPoints(d).map(p => p.y))
}

test('a forward semicircle dips below the baseline', () => {
  const s = semicircle(0, 200)
  const d = arcPathD(s)
  expect(apexY(d)).toBeCloseTo(100, 6)
  expect(arcApexY(s)).toBe(100)
  expect(Math.min(...arcPoints(d).map(p => p.y))).toBeCloseTo(0, 6)
})

test('a reversed semicircle dips below it too, not above', () => {
  // a reversed region puts `left` past `right`; the label already draws at
  // +radius, so an arc apexing at -radius leaves the label floating over an
  // arc that has been clipped away
  const s = semicircle(800, 600)
  const d = arcPathD(s)
  expect(apexY(d)).toBeCloseTo(100, 6)
  expect(arcApexY(s)).toBe(100)
  for (const { y } of arcPoints(d)) {
    expect(y).toBeGreaterThanOrEqual(-1e-9)
  }
})

test('the two orientations draw the same semicircle', () => {
  const forward = arcPoints(arcPathD(semicircle(600, 800)))
  const reversed = arcPoints(arcPathD(semicircle(800, 600))).reverse()
  for (const [i, p] of forward.entries()) {
    expect(p.x).toBeCloseTo(reversed[i]!.x, 6)
    expect(p.y).toBeCloseTo(reversed[i]!.y, 6)
  }
})

// The bezier's `d`, read back the way a renderer reads it. Both control points
// share their foot's x, so `M`/`C` is the whole curve.
function bezierPoints(d: string, samples = 64) {
  const m =
    /^M (\S+) (\S+) C (\S+) (\S+), (\S+) (\S+), (\S+) (\S+)$/.exec(d) ??
    (() => {
      throw new Error(`not a single-bezier path: ${d}`)
    })()
  const [x0, y0, x1, y1, x2, y2, x3, y3] = m.slice(1).map(Number)
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples
    const u = 1 - t
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
    return {
      x: w[0]! * x0! + w[1]! * x1! + w[2]! * x2! + w[3]! * x3!,
      y: w[0]! * y0! + w[1]! * y1! + w[2]! * y2! + w[3]! * y3!,
    }
  })
}

// The check the hit test rests on, and the reason `arcDistancePx` is in the same
// file as `arcPathD`: the export draws the `d` and the canvas hover measures
// against this function, so a point ON the exported path has to measure as zero
// distance. Sabotaging either half — the bezier's control points, the flattening
// — moves these off zero.
test('every point on the exported path measures as ink', () => {
  const cases: ArcShape[] = [
    semicircle(0, 200),
    semicircle(800, 600),
    { kind: 'bezier', left: 10, right: 410, height: 60 },
    { kind: 'bezier', left: 500, right: 100, height: 200 },
    // tall and narrow, where the flattening has the least room
    { kind: 'bezier', left: 300, right: 320, height: 180 },
  ]
  for (const s of cases) {
    const d = arcPathD(s)
    const pts = s.kind === 'semicircle' ? arcPoints(d) : bezierPoints(d)
    for (const p of pts) {
      expect(arcDistancePx(s, p.x, p.y)).toBeLessThan(0.05)
    }
  }
})

test('a point off the curve measures its real distance', () => {
  // straight down from the apex of a semicircle, so the answer is exact
  const s = semicircle(0, 200)
  expect(arcDistancePx(s, 100, 100)).toBeCloseTo(0, 6)
  expect(arcDistancePx(s, 100, 90)).toBeCloseTo(10, 6)
  expect(arcDistancePx(s, 100, 130)).toBeCloseTo(30, 6)
  // the interior of the circle, which is not ink
  expect(arcDistancePx(s, 100, 5)).toBeCloseTo(95, 6)
})

test("above the baseline the nearest ink is a semicircle's foot", () => {
  // Only the lower half is drawn, so the circle formula would answer for ink
  // that is not there — 4px above the left foot is 4px from it, not 96 from a
  // mirrored arc.
  expect(arcDistancePx(semicircle(0, 200), 0, -4)).toBeCloseTo(4, 6)
})

test('the canvas stroke traces the path the export writes', () => {
  const calls: string[] = []
  const ctx = {
    beginPath: () => calls.push('beginPath'),
    stroke: () => calls.push('stroke'),
    moveTo: (...a: number[]) => calls.push(`moveTo ${a.join(' ')}`),
    bezierCurveTo: (...a: number[]) => calls.push(`bezier ${a.join(' ')}`),
    arc: (...a: number[]) => calls.push(`arc ${a.join(' ')}`),
  } as unknown as CanvasRenderingContext2D

  arcStroke(ctx, { kind: 'bezier', left: 10, right: 410, height: 60 })
  expect(calls).toEqual([
    'beginPath',
    'moveTo 10 0',
    'bezier 10 60 410 60 410 0',
    'stroke',
  ])
  // the same four numbers the `d` carries
  expect(arcPathD({ kind: 'bezier', left: 10, right: 410, height: 60 })).toBe(
    'M 10 0 C 10 60, 410 60, 410 0',
  )

  calls.length = 0
  arcStroke(ctx, semicircle(800, 600))
  // centre 700, radius 100, swept 0 → π, which is DOWN — a reversed region
  // needs no flag here, unlike the `d` above, where the sweep is a direction of
  // travel
  expect(calls).toEqual(['beginPath', `arc 700 0 100 0 ${Math.PI}`, 'stroke'])
})

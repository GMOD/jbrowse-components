import { getSemicirclePath } from './Arcs.tsx'

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
  const { d, textYCoord } = getSemicirclePath(0, 200)
  expect(apexY(d)).toBeCloseTo(100, 6)
  expect(textYCoord).toBe(100)
  expect(Math.min(...arcPoints(d).map(p => p.y))).toBeCloseTo(0, 6)
})

test('a reversed semicircle dips below it too, not above', () => {
  // a reversed region puts `left` past `right`; the label already draws at
  // +radius, so an arc apexing at -radius leaves the label floating over an
  // arc that has been clipped away
  const { d, textYCoord } = getSemicirclePath(800, 600)
  expect(apexY(d)).toBeCloseTo(100, 6)
  expect(textYCoord).toBe(100)
  for (const { y } of arcPoints(d)) {
    expect(y).toBeGreaterThanOrEqual(-1e-9)
  }
})

test('the two orientations draw the same semicircle', () => {
  const forward = arcPoints(getSemicirclePath(600, 800).d)
  const reversed = arcPoints(getSemicirclePath(800, 600).d).reverse()
  for (const [i, p] of forward.entries()) {
    expect(p.x).toBeCloseTo(reversed[i]!.x, 6)
    expect(p.y).toBeCloseTo(reversed[i]!.y, 6)
  }
})

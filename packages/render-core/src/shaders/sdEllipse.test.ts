// `sdEllipse` (curveDistance.slang) measures a fragment's distance to the arc
// band's and the link mark's half-ellipse. The shader runs it in float32, and
// float32 is the whole subject here: the same source in float64 is exact to
// 1e-9 at every shape below, so nothing a float64 test can reach says whether
// the picture is right.
//
// What goes wrong when it is not: the stroke reads the distance through a ramp
// one output pixel wide, so at dpr 2 an error of half a CSS px is the whole of
// the ink and the curve breaks into scattered dots. That is what a dome at
// 380x249 did on WebGL while Canvas2D drew it solid.
//
// The shader isn't unit-testable, so this models it — same approach and same
// reason as glyphEdgeAlpha.test.ts. The reference is a brute-force minimum over
// the parametric angle, as in marks/ellipseDistance.test.ts: the DEFINITION of
// the distance rather than a second evaluation of the same formula.
// SYNC: keep in step with curveDistance.slang's sdEllipse.
import { edgeCoverage } from './antialias.js.generated.ts'

const f = Math.fround
const len = (x: number, y: number) => f(Math.sqrt(f(f(x * x) + f(y * y))))

const ELLIPSE_CIRCLE_TOL = 0.05

function nearCircleDistancePx(qx: number, qy: number, ax: number, ay: number) {
  const k = len(f(qx / ax), f(qy / ay))
  const g = len(f(qx / f(ax * ax)), f(qy / f(ay * ay)))
  return Math.abs(f(f(k * f(k - 1)) / Math.max(g, 1e-20)))
}

function sdEllipse(px: number, py: number, radiusX: number, radiusY: number) {
  let qx = Math.abs(px)
  let qy = Math.abs(py)
  let ax = radiusX
  let ay = radiusY
  if (qx > qy) {
    ;[qx, qy] = [qy, qx]
    ;[ax, ay] = [ay, ax]
  }
  const l = f(f(ay * ay) - f(ax * ax))
  if (Math.abs(l) < f(ELLIPSE_CIRCLE_TOL * f(ay * ay))) {
    return nearCircleDistancePx(qx, qy, ax, ay)
  }
  const m = f(f(ax * qx) / l)
  const m2 = f(m * m)
  const n = f(f(ay * qy) / l)
  const n2 = f(n * n)
  const c = f(f(f(m2 + n2) - 1) / 3)
  const c3 = f(f(c * c) * c)
  const d = f(c3 + f(m2 * n2))
  const g = f(m + f(m * n2))
  let co: number
  if (d < 0) {
    const h = f(
      Math.acos(Math.max(-1, Math.min(1, f(f(c3 + f(f(m2 * n2) * 2)) / c3)))) /
        3,
    )
    const s = f(Math.cos(h))
    const t = f(f(Math.sin(h)) * f(Math.sqrt(3)))
    const rx = f(Math.sqrt(Math.max(f(f(-c * f(f(s + t) + 2)) + m2), 0)))
    const ry = f(Math.sqrt(Math.max(f(f(-c * f(f(s - t) + 2)) + m2), 0)))
    co = f(
      f(
        f(
          f(ry + f(Math.sign(l) * rx)) +
            f(Math.abs(g) / Math.max(f(rx * ry), 1e-20)),
        ) - m,
      ) / 2,
    )
  } else {
    const qq = f(c3 + f(f(m2 * n2) * 2))
    const h = f(f(f(2 * m) * n) * f(Math.sqrt(d)))
    const w = f(qq + h)
    const aw = Math.abs(w)
    const s = f(Math.sign(w) * f(Math.pow(aw, f(1 / 3))))
    const t =
      aw > 0 ? f(Math.sign(w) * f(Math.pow(f(c3 * f(c3 / aw)), f(1 / 3)))) : 0
    const rx = f(f(f(f(-s - t) - f(c * 4)) + f(2 * m2)))
    const ry = f(f(s - t) * f(Math.sqrt(3)))
    const rm = len(rx, ry)
    co = f(
      f(
        f(
          f(ry / f(Math.sqrt(Math.max(f(rm - rx), 1e-20)))) +
            f(f(2 * g) / Math.max(rm, 1e-20)),
        ) - m,
      ) / 2,
    )
  }
  co = Math.max(-1, Math.min(1, co))
  const ex = f(ax * co)
  const ey = f(ay * f(Math.sqrt(Math.max(f(1 - f(co * co)), 0))))
  return len(f(ex - qx), f(ey - qy))
}

function bruteForce(px: number, py: number, rx: number, ry: number) {
  const d = (t: number) =>
    Math.hypot(rx * Math.cos(t) - Math.abs(px), ry * Math.sin(t) - Math.abs(py))
  let bestT = 0
  let best = Number.POSITIVE_INFINITY
  const N = 1000
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * (Math.PI / 2)
    const v = d(t)
    if (v < best) {
      best = v
      bestT = t
    }
  }
  const cell = Math.PI / 2 / N
  let lo = bestT - 2 * cell
  let hi = bestT + 2 * cell
  for (let i = 0; i < 60; i++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (d(m1) < d(m2)) {
      hi = m2
    } else {
      lo = m1
    }
  }
  return d((lo + hi) / 2)
}

const HALF_PX = 1
const DPR = 2

/** Worst distance error, and the worst change in ink it causes, over a stroke. */
function scoreStroke(rx: number, ry: number) {
  let worst = 0
  let worstInk = 0
  for (let k = 0; k <= 40; k++) {
    const t = (Math.PI * k) / 40
    const ex = rx * Math.cos(t)
    const ey = -ry * Math.sin(t)
    // Along the outward normal, so the samples straddle the stroke the way a
    // fragment inside the hull does rather than sitting on a grid.
    const nx = ry * Math.cos(t)
    const ny = -rx * Math.sin(t)
    const nl = Math.hypot(nx, ny) || 1
    for (let i = -7; i <= 7; i++) {
      const off = (i / 7) * (HALF_PX + 1 / DPR)
      const px = ex + (nx / nl) * off
      const py = ey + (ny / nl) * off
      const ref = bruteForce(px, py, rx, ry)
      const got = sdEllipse(px, py, rx, ry)
      worst = Math.max(worst, Math.abs(got - ref))
      worstInk = Math.max(
        worstInk,
        Math.abs(
          edgeCoverage(HALF_PX - got, DPR) - edgeCoverage(HALF_PX - ref, DPR),
        ),
      )
    }
  }
  return { worst, worstInk }
}

// Every shape here broke before the two float32 guards went in, except the last
// three, which are the regression side: the flat end the closed form was chosen
// for, and the exact circle. The figures in the comments are what the COMPILED
// shader did, measured through slangc's C++ target over the same samples.
//
// The rows are not interchangeable — between them they reach all three paths,
// which is what keeps a change to one from being scored on another. Of each
// row's 615 samples: the two domes and the 260x250 take the cube-root branch
// (600, 600, 615), the two bands take the trigonometric one (589, 597) and are
// the only cover it has, and the four near-circles take the new branch whole.
test.each([
  ['the captured speckled dome', 380.25, 249], // was 2.9px out
  ['a dome at 3:2, 1000px tall', 1500, 1000], // was 10.9px out
  ['radii a millionth apart', 250.00025, 250], // was 49px out, 70% of the stroke
  ['radii 1e-5 apart', 250.0025, 250], // was 3.6px out
  ['radii 1e-4 apart', 250.025, 250],
  ['near-circle at 2000px', 2000.2, 2000], // was 2.3px out
  ['just outside the near-circle branch', 260, 250],
  ['a 44:1 band', 1100, 25],
  ['a 88:1 band', 2200, 25],
  ['an exact circle', 250, 250],
])('float32 holds the stroke: %s', (_name, rx, ry) => {
  const { worst, worstInk } = scoreStroke(rx, ry)
  // A tenth of the ramp. The margin is what matters rather than the figure —
  // the failures this pins were one to two hundred times the ramp's whole
  // width, not a rounding away from it.
  expect(worst).toBeLessThan(0.05)
  expect(worstInk).toBeLessThan(0.1)
})

test('the near-circle branch answers a true circle exactly', () => {
  // With equal radii the implicit form reduces to |q| - r algebraically, which
  // is why it can replace the dedicated circle branch it grew out of.
  expect(nearCircleDistancePx(3, 4, 1, 1)).toBeCloseTo(4, 6)
  expect(nearCircleDistancePx(30, 40, 100, 100)).toBeCloseTo(50, 4)
})

// Exact distance from a point to the axis-aligned ellipse |p/ab| = 1 — Inigo
// Quilez's closed-form solve of the quartic, in float64.
//
// THIS IS A SECOND COPY of `sdEllipse` in curveDistance.slang, and the header
// there carries the argument for why it is not generated instead. The short
// version: making it liftable also enrolls it in `check-shader-oracle`, which
// referees the float64 twin against slangc's float32 C++ — and a quartic solve
// is exactly the shape that comparison cannot referee, because float32 loses
// the solver before the transliteration is in question.
//
// So the two copies are NOT held together by parity with each other. What has to
// agree is which ellipse, and that is the radii pair each consumer lifts
// (`arcRadiiPx`, `linkRadiiPx`), which both the shader and this file's callers
// read. Given the same two radii, this is geometry with one right answer, and
// `ellipseDistance.test.ts` pins it against a brute-force minimum over the
// parametric angle — a stronger check than agreeing with a float32 evaluation
// of the same formula would have been.
//
// The closed form rather than an iterative solve, for the reason the shader
// gives: the arc band produces very flat ellipses (a 25px band under a 1500px
// pair is 44:1, and it goes past 88:1), and a seeded Newton on the parametric
// angle runs away entirely there.

// The first-quadrant solve: `co` is the cosine of the parametric angle of the
// nearest point to (qx, qy), radii (ax, ay), with the point and radii already
// mirrored into the half where qx <= qy.
function nearestCos(qx: number, qy: number, ax: number, ay: number) {
  const l = ay * ay - ax * ax
  const m = (ax * qx) / l
  const m2 = m * m
  const n = (ay * qy) / l
  const n2 = n * n
  const c = (m2 + n2 - 1) / 3
  const c3 = c * c * c
  const d = c3 + m2 * n2
  const g = m + m * n2
  let co: number
  if (d < 0) {
    const h = Math.acos(clamp1((c3 + m2 * n2 * 2) / c3)) / 3
    const s = Math.cos(h)
    const t = Math.sin(h) * Math.sqrt(3)
    const ux = Math.sqrt(Math.max(-c * (s + t + 2) + m2, 0))
    const uy = Math.sqrt(Math.max(-c * (s - t + 2) + m2, 0))
    co =
      (uy + Math.sign(l) * ux + Math.abs(g) / Math.max(ux * uy, 1e-20) - m) / 2
  } else {
    const qq = c3 + m2 * n2 * 2
    const h = 2 * m * n * Math.sqrt(d)
    const s = Math.sign(qq + h) * Math.cbrt(Math.abs(qq + h))
    const t = Math.sign(qq - h) * Math.cbrt(Math.abs(qq - h))
    const ux = -s - t - c * 4 + 2 * m2
    const uy = (s - t) * Math.sqrt(3)
    const rm = Math.hypot(ux, uy)
    co =
      (uy / Math.sqrt(Math.max(rm - ux, 1e-20)) +
        (2 * g) / Math.max(rm, 1e-20) -
        m) /
      2
  }
  return clamp1(co)
}

export function ellipseDistance(
  px: number,
  py: number,
  rx: number,
  ry: number,
) {
  let qx = Math.abs(px)
  let qy = Math.abs(py)
  let ax = rx
  let ay = ry
  // Solve in the half where q.x <= q.y, mirroring point and radii together.
  if (qx > qy) {
    ;[qx, qy] = [qy, qx]
    ;[ax, ay] = [ay, ax]
  }
  const l = ay * ay - ax * ax
  // Circle: `l` is the solver's divisor, so hand those back the exact answer
  // rather than a division by ~0. Reachable — a clamped dome's ry is pinned to
  // the band while rx tracks the pair's width, so they cross.
  if (Math.abs(l) < 1e-6 * ay * ay) {
    return Math.abs(Math.hypot(qx, qy) - ax)
  }
  const co = nearestCos(qx, qy, ax, ay)
  return Math.hypot(ax * co - qx, ay * Math.sqrt(Math.max(1 - co * co, 0)) - qy)
}

/**
 * The point of the ellipse nearest (px, py), in the ellipse's own frame, and
 * how far it is: what a hit test hands back as the ink it found.
 */
export function ellipseNearest(
  px: number,
  py: number,
  rx: number,
  ry: number,
): { x: number; y: number; dist: number } {
  let qx = Math.abs(px)
  let qy = Math.abs(py)
  let ax = rx
  let ay = ry
  const swapped = qx > qy
  if (swapped) {
    ;[qx, qy] = [qy, qx]
    ;[ax, ay] = [ay, ax]
  }
  const l = ay * ay - ax * ax
  let nx: number
  let ny: number
  if (Math.abs(l) < 1e-6 * ay * ay) {
    const len = Math.hypot(qx, qy)
    nx = len > 0 ? (qx / len) * ax : ax
    ny = len > 0 ? (qy / len) * ax : 0
  } else {
    const co = nearestCos(qx, qy, ax, ay)
    nx = ax * co
    ny = ay * Math.sqrt(Math.max(1 - co * co, 0))
  }
  const dist = Math.hypot(nx - qx, ny - qy)
  if (swapped) {
    ;[nx, ny] = [ny, nx]
  }
  return {
    x: px < 0 ? -nx : nx,
    y: py < 0 ? -ny : ny,
    dist,
  }
}

function clamp1(x: number) {
  return x < -1 ? -1 : x > 1 ? 1 : x
}

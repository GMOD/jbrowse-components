import { ellipseDistance } from './ellipseDistance.ts'

// The reference is a brute-force minimum over the parametric angle: coarse scan,
// then ternary refinement. Slow and obviously correct, which is the point — the
// closed form is checked against the DEFINITION of the distance rather than
// against another evaluation of the same formula.
function bruteForce(px: number, py: number, rx: number, ry: number) {
  const d = (t: number) =>
    Math.hypot(rx * Math.cos(t) - Math.abs(px), ry * Math.sin(t) - Math.abs(py))
  let bestT = 0
  let best = Number.POSITIVE_INFINITY
  // Coarse scan only has to land in the right basin; the ternary search below
  // supplies the precision, so N trades against runtime and not against the
  // answer. The bracket is +-2 cells rather than +-1 so the true minimum is
  // inside it even when the discrete argmin sits at a cell edge.
  const N = 2000
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
  for (let i = 0; i < 200; i++) {
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

test('agrees with a brute-force minimum across the arc band’s aspect range', () => {
  // rx is half a pair's on-screen width — 0 up to canvasW/2, past which
  // `arcRadiiPx` switches to the circle branch and this function is not the one
  // asked. ry is 0.75x the apex offset, which the band clamps to availH. The
  // extremes here are 2000:1 and 1:300, both well past the 88:1 the shader's own
  // note measures to.
  let worst = 0
  for (const rx of [0.5, 8, 150, 1000]) {
    for (const ry of [0.5, 2, 18, 150]) {
      for (let i = 0; i <= 8; i++) {
        const t = (i / 8) * (Math.PI / 2)
        const ex = rx * Math.cos(t)
        const ey = ry * Math.sin(t)
        // Walk the outward normal, so the samples straddle the curve the way a
        // cursor near a stroke does rather than sitting on a grid.
        const nx = ex / (rx * rx)
        const ny = ey / (ry * ry)
        const nl = Math.hypot(nx, ny) || 1
        for (const off of [-6, -1, -0.25, 0, 0.25, 1, 6]) {
          const px = ex + (nx / nl) * off
          const py = ey + (ny / nl) * off
          worst = Math.max(
            worst,
            Math.abs(
              ellipseDistance(px, py, rx, ry) - bruteForce(px, py, rx, ry),
            ),
          )
        }
      }
    }
  }
  // Measured 4.0e-6 px. A hover tolerance is whole pixels, so the margin here is
  // six orders of magnitude — the assertion is that the solver did not degenerate
  // on a flat ellipse, not that it is accurate to a particular decimal.
  expect(worst).toBeLessThan(1e-4)
})

test('a circle is the degenerate case the branch exists for', () => {
  // rx == ry makes `l` the solver's divisor zero; the short-circuit answers
  // |distance to centre - r| exactly.
  expect(ellipseDistance(3, 4, 1, 1)).toBeCloseTo(4, 12)
  expect(ellipseDistance(0.5, 0, 1, 1)).toBeCloseTo(0.5, 12)
  // Inside and outside are both unsigned — the hit test only ever asks how far.
  expect(ellipseDistance(0, 0, 2, 2)).toBeCloseTo(2, 12)
})

test('a point on the curve is at distance zero', () => {
  for (const [rx, ry] of [
    [10, 10],
    [200, 3],
    [3, 200],
  ]) {
    for (const t of [0, 0.3, 1, Math.PI / 2 - 0.01, Math.PI / 2]) {
      const d = ellipseDistance(rx! * Math.cos(t), ry! * Math.sin(t), rx!, ry!)
      expect(d).toBeLessThan(1e-6)
    }
  }
})

test('the answer is symmetric in both axes, as the arc band relies on', () => {
  // The band mirrors an up-pointing arc into a down-pointing one by flipping the
  // sign of the local y, and never mirrors the radii — so the two must agree.
  for (const [px, py] of [
    [3, 7],
    [0.25, 60],
    [900, 1],
  ]) {
    const base = ellipseDistance(px!, py!, 400, 20)
    expect(ellipseDistance(-px!, py!, 400, 20)).toBeCloseTo(base, 12)
    expect(ellipseDistance(px!, -py!, 400, 20)).toBeCloseTo(base, 12)
    expect(ellipseDistance(-px!, -py!, 400, 20)).toBeCloseTo(base, 12)
  }
})

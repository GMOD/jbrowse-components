import { planFlight } from './flyTo.ts'

import type { FlightViewport } from './flyTo.ts'

// A row showing a whole 250Mb assembly at a 40kb window, sent 120Mb away — the
// shape the off-screen mate click produces, and the one a constant-scale pan
// cannot serve.
const NEAR: FlightViewport = { centerBp: 1_000_000, windowWidthBp: 40_000 }
const FAR: FlightViewport = { centerBp: 121_000_000, windowWidthBp: 40_000 }

function widths(flight: ReturnType<typeof planFlight>) {
  return Array.from({ length: 21 }, (_, i) => flight.at(i / 20).windowWidthBp)
}

test('the ends of the path are the ends the caller asked for', () => {
  const flight = planFlight(NEAR, FAR)

  expect(flight.at(0).centerBp).toBeCloseTo(NEAR.centerBp, 3)
  expect(flight.at(0).windowWidthBp).toBeCloseTo(NEAR.windowWidthBp, 3)
  // exactly, not closely: the closed form reaches the destination only to
  // within the rounding of two hyperbolics, and a viewport that lands a few bp
  // off is a viewport the caller's Undo cannot recognize
  expect(flight.at(1)).toEqual(FAR)
  expect(flight.at(1.4)).toEqual(FAR)
})

// The whole point of the arc. Panned at a constant 40kb window this is three
// thousand screens of streaking; pulled back to where both ends fit, it is a
// picture of the distance being crossed.
test('a long hop pulls back far enough to hold both ends, then comes back', () => {
  const flight = planFlight(NEAR, FAR)
  const seen = widths(flight)
  const apex = Math.max(...seen)

  expect(apex).toBeGreaterThan(FAR.centerBp - NEAR.centerBp)
  expect(seen[0]).toBeCloseTo(NEAR.windowWidthBp, 3)
  expect(seen.at(-1)).toBeCloseTo(FAR.windowWidthBp, 3)
})

// The claim the citation actually rests on. Equation (9) is a geodesic that is
// ARC LENGTH PARAMETRIZED under the paper's metric, which is their condition
// (7): rho^2 * u'^2 + w'^2 / rho^2 = w^2, with the dots taken against `s`. Get
// the algebra wrong in a way the endpoint assertions cannot see — a dropped
// cosh, `t` where `rho*s + r0` belongs — and the path still starts and finishes
// in the right place while the motion through the middle is no longer uniform,
// which is the entire reason to use their solution over an interpolation.
//
// Differentiated against `t` rather than `s`, since `planFlight` does not
// publish `S`: that scales the left side by S^2, so the test is that the
// quantity is CONSTANT along the path rather than that it equals any
// particular number.
test("the path is the paper's geodesic, not merely its endpoints", () => {
  const RHO2 = 2
  const h = 1e-6
  const flight = planFlight(NEAR, FAR)
  const speeds = [0.1, 0.25, 0.5, 0.75, 0.9].map(t => {
    const before = flight.at(t - h)
    const after = flight.at(t + h)
    const du = (after.centerBp - before.centerBp) / (2 * h)
    const dw = (after.windowWidthBp - before.windowWidthBp) / (2 * h)
    const w = flight.at(t).windowWidthBp
    return (RHO2 * du * du + (dw * dw) / RHO2) / (w * w)
  })

  for (const speed of speeds) {
    expect(speed / speeds[0]!).toBeCloseTo(1, 4)
  }
})

test('the pan is monotone, so nothing doubles back on its way', () => {
  const flight = planFlight(NEAR, FAR)
  const centers = Array.from(
    { length: 21 },
    (_, i) => flight.at(i / 20).centerBp,
  )

  for (let i = 1; i < centers.length; i++) {
    expect(centers[i]!).toBeGreaterThan(centers[i - 1]!)
  }
})

test('a hop backwards is the same path mirrored', () => {
  const forward = planFlight(NEAR, FAR)
  const back = planFlight(FAR, NEAR)

  expect(back.durationMs).toBeCloseTo(forward.durationMs, 6)
  expect(back.at(0.5).centerBp).toBeCloseTo(forward.at(0.5).centerBp, 3)
  expect(back.at(0.5).windowWidthBp).toBeCloseTo(
    forward.at(0.5).windowWidthBp,
    3,
  )
})

// Van Wijk's own duration for the long hop is about ten seconds, which is a
// wait rather than a transition, so it is held under a ceiling. The short one
// is held over a floor for the opposite reason. Neither hop here is AT a bound,
// so the ordering between them is the rate's and not the clamp's.
test('the duration is bounded at both ends and orders the two hops between', () => {
  const long = planFlight(NEAR, FAR).durationMs
  const short = planFlight(NEAR, {
    ...NEAR,
    centerBp: NEAR.centerBp + 300_000,
  }).durationMs

  expect(short).toBeGreaterThan(250)
  expect(long).toBeLessThanOrEqual(1100)
  expect(long).toBeGreaterThan(short)
  expect(
    planFlight(NEAR, { ...NEAR, centerBp: NEAR.centerBp + 4_000 }).durationMs,
  ).toBe(250)
})

test('a destination the view is already at is not a flight at all', () => {
  expect(planFlight(NEAR, NEAR).durationMs).toBe(0)
  expect(planFlight(NEAR, { ...NEAR }).durationMs).toBe(0)
})

// The degenerate arm, and the reason the stationary test is relative: the
// general solution divides by the distance travelled, so a hop of a few bp
// between two zooms sends `b` through infinity and every sample back as NaN.
test('a hop too small to see is flown as a pure zoom, not as NaN', () => {
  const flight = planFlight(NEAR, {
    centerBp: NEAR.centerBp + 0.0001,
    windowWidthBp: 400,
  })

  expect(flight.durationMs).toBeGreaterThan(0)
  for (const width of widths(flight)) {
    expect(Number.isFinite(width)).toBe(true)
  }
  expect(flight.at(0.5).windowWidthBp).toBeLessThan(NEAR.windowWidthBp)
  expect(flight.at(0.5).windowWidthBp).toBeGreaterThan(400)
})

test('the same place at the same scale has no zoom to play either', () => {
  expect(
    planFlight(NEAR, {
      centerBp: NEAR.centerBp + 0.0001,
      windowWidthBp: 40_000,
    }).durationMs,
  ).toBe(0)
})

// A hop shorter than the window it happens in still travels; what it must not
// do is pull back to cover a distance already on screen.
test('a hop inside the current window barely zooms out', () => {
  const flight = planFlight(NEAR, {
    ...NEAR,
    centerBp: NEAR.centerBp + 10_000,
  })

  expect(Math.max(...widths(flight))).toBeLessThan(NEAR.windowWidthBp * 1.5)
})

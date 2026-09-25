import { KIND_BASE, KIND_MARKER } from '../../LinearSyntenyRPC/syntenyColors.ts'
// Two things isCulled and fillEdges dropped, each because the value it guarded
// against is unreachable. Both are algebra over the generated scalars, so a
// shader edit that breaks the premise fails here rather than at a pixel.
import {
  isMarkerKind,
  markerTravelsTooFar,
  spanOutsideBand,
  yCurve,
} from './syntenyTypes.js.generated.ts'

type Corners = [number, number, number, number]

function hullOutside(c: Corners, w: number, pad: number) {
  const [x, y, z, q] = c
  return spanOutsideBand(Math.min(x, y, z, q), Math.max(x, y, z, q), w, pad)
}

function perEdgeOutside(c: Corners, w: number, pad: number) {
  const [x, y, z, q] = c
  return (
    spanOutsideBand(Math.min(x, y), Math.max(x, y), w, pad) ||
    spanOutsideBand(Math.min(z, q), Math.max(z, q), w, pad)
  )
}

// isCulled as it stood, with the hull test first and unconditional.
function culledWithHull(c: Corners, kind: number, w: number, pad: number) {
  if (hullOutside(c, w, pad)) {
    return true
  }
  if (isMarkerKind(kind)) {
    return markerTravelsTooFar(c[0], c[2], w)
  }
  return perEdgeOutside(c, w, pad)
}

// isCulled as it stands, with the hull test inside the marker arm.
function culled(c: Corners, kind: number, w: number, pad: number) {
  if (isMarkerKind(kind)) {
    return hullOutside(c, w, pad) || markerTravelsTooFar(c[0], c[2], w)
  }
  return perEdgeOutside(c, w, pad)
}

const W = 800
const PAD = 40
const XS = [
  -4000, -900, -841, -840, -839, -40, 0, 1, 400, 799, 800, 839, 840, 841, 900,
  4000,
]

function* cornerSweep(): Generator<Corners> {
  for (const x of XS) {
    for (const y of XS) {
      for (const z of XS) {
        for (const q of XS) {
          yield [x, y, z, q]
        }
      }
    }
  }
}

test('a hull outside the band makes both per-edge tests true', () => {
  let outside = 0
  for (const c of cornerSweep()) {
    if (hullOutside(c, W, PAD)) {
      outside++
      const [x, y, z, q] = c
      expect(spanOutsideBand(Math.min(x, y), Math.max(x, y), W, PAD)).toBe(true)
      expect(spanOutsideBand(Math.min(z, q), Math.max(z, q), W, PAD)).toBe(true)
    }
  }
  expect(outside).toBe(706)
})

test('moving the hull test into the marker arm culls the same instances', () => {
  for (const c of cornerSweep()) {
    for (const kind of [KIND_BASE, KIND_MARKER]) {
      expect(culled(c, kind, W, PAD)).toBe(culledWithHull(c, kind, W, PAD))
    }
  }
})

test('a marker still needs the hull test', () => {
  // Both ends far left of the band, and coincident, so the travel cap keeps it.
  const offscreen: Corners = [-4000, -4000, -3990, -3990]
  expect(markerTravelsTooFar(offscreen[0], offscreen[2], W)).toBe(false)
  expect(culled(offscreen, KIND_MARKER, W, PAD)).toBe(true)
})

// fillEdges divides by `abs(dydt)`; it used to divide by `max(abs(dydt), 1e-4)`.
// dydt is `u.height` in straight mode and `u.height * yCurve'(t)` in curve mode,
// so the floor was unreachable from both: the CPU floors height at 1
// (syntenyRibbonMarks) and yCurve' bottoms out at 0.75.
test('the curve basis never brings dy/dt near the floor it was clamped to', () => {
  const h = 1e-6
  let min = Infinity
  for (let i = 0; i <= 100000; i++) {
    const t = i / 100000
    min = Math.min(min, Math.abs((yCurve(t + h) - yCurve(t - h)) / (2 * h)))
  }
  expect(min).toBeGreaterThan(0.74)
  expect(min).toBeLessThan(0.76)
})

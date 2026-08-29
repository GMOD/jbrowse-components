// dotplot.slang splits one job across its two stages: the vertex shader emits a
// quad around the segment, and the fragment clips that quad to a capsule with an
// antialiased edge. If the quad is smaller than the region the fragment would
// shade, the rasterizer crops the AA ramp and the line ends on a hard edge —
// aliased, and narrower than lineWidth asked for. Nothing else can catch that:
// the shader isn't unit-testable and no browser suite exercises the GPU path.
//
// So this mirrors vs_main's quad and fs_main's capsule SDF and asserts the
// invariant the pair relies on: every point the fragment would give non-zero
// coverage lies inside the polygon the vertex stage emitted.
// SYNC: keep in step with vs_main's `ext` and fs_main's ramp.
//
// The synteny twin is shaders/syntenyFillPad.test.ts, which exists for the same
// reason and found the same class of bug.
//
// What is modelled and what is imported is not a style choice. The frame, the
// quad and the SDF all take or build a float2, so the emitter refuses them and
// a local model is the only option. The two SCALARS that decide how far the
// ramp reaches are imported, because a model of those is what silently goes
// stale: this file mirrored `len > 0.001` and kept passing after the capsule
// extraction unified the guard to 1e-4, since a copy checked against itself
// agrees with itself.
//
// The imports are also what make this file a MODULE. Both pad tests model the
// shader in bare top-level helpers, and an import-less .test.ts is a global
// script to TypeScript — so a second one collides with the first on every shared
// helper name (TS2393).
import { aaHalfPx, edgeCoverage } from '@jbrowse/render-core/shaders/antialias'
import { CAPSULE_MIN_LEN_PX } from '@jbrowse/render-core/shaders/capsuleConsts'

import { VERTS_PER_INSTANCE } from './dotplot.iface.generated.ts'

interface Pt {
  x: number
  y: number
}

// How far past the ink's edge the FRAGMENT still writes coverage, found by
// asking the shader's own ramp rather than restating `0.5 / dpr`. Bisection
// because the coverage is monotone in `d`: the answer is the largest distance
// it still returns a non-zero for.
//
// This is deliberately not the same number as the quad's `ext` below. The whole
// invariant is that the VERTEX stage's pad covers the FRAGMENT stage's reach,
// and deriving one from the other makes every assertion here an identity — as
// it was until the two came off separate shader functions.
function reachFor(halfWidth: number, dpr: number) {
  let lo = halfWidth
  let hi = halfWidth + 4
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (edgeCoverage(halfWidth - mid, dpr) > 0) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return hi
}

// vs_main's tangent/normal, including the degenerate fallback for a segment too
// short to have a direction.
function segmentFrame(p1: Pt, p2: Pt) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  const degenerate = len <= CAPSULE_MIN_LEN_PX
  return {
    dx,
    dy,
    len,
    tx: degenerate ? 1 : dx / len,
    ty: degenerate ? 0 : dy / len,
    nx: degenerate ? 0 : -dy / len,
    ny: degenerate ? 1 : dx / len,
  }
}

// vs_main's quad, as a convex ring of its four distinct corners, so containment
// is tested against the positions the vertex stage actually emits rather than
// against a restatement of the rectangle they form. `ext` is the extension along
// both the tangent and the normal — the shader passes halfWidth + aaHalf, and
// the "do not reintroduce" test below passes the halfWidth it used to.
function quadRing(p1: Pt, p2: Pt, ext: number): Pt[] {
  const { dx, dy, tx, ty, nx, ny } = segmentFrame(p1, p2)
  return (
    [
      [0, -1],
      [0, 1],
      [1, 1],
      [1, -1],
    ] as const
  ).map(([t, side]) => ({
    x: p1.x + dx * t + tx * (t * 2 - 1) * ext + nx * side * ext,
    y: p1.y + dy * t + ty * (t * 2 - 1) * ext + ny * side * ext,
  }))
}

// Signed area sign of the ring, then the same sign for every edge->point cross
// product. The quad is convex by construction (a rectangle in the segment's own
// frame), so this is exact. Tolerance is one part in 1e-9 of the coordinate
// scale: a point exactly ON the boundary is contained, and `ext` makes the
// capsule touch the quad's sides exactly, so the invariant is tight rather than
// slack and floating point has to be admitted.
function insideRing(ring: Pt[], p: Pt) {
  let sign = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    const scale = Math.max(1, Math.abs(p.x), Math.abs(p.y))
    if (Math.abs(cross) < 1e-9 * scale * scale) {
      continue
    }
    const s = Math.sign(cross)
    if (sign === 0) {
      sign = s
    } else if (s !== sign) {
      return false
    }
  }
  return true
}

// fs_main: distance from a point (in the segment's own frame) to the segment
// {(0,0)..(len,0)}, i.e. the capsule SDF. Coverage is non-zero while
// d < halfWidth + aaHalf.
function distToSegmentLocal(u: number, v: number, len: number) {
  const cu = Math.min(Math.max(u, 0), len)
  return Math.hypot(u - cu, v)
}

// Worst distance by which the emitted quad crops the shaded region, over a grid
// covering the capsule and a margin around it. Zero means the quad contains
// every shaded point.
function worstCrop(
  p1: Pt,
  p2: Pt,
  halfWidth: number,
  dpr: number,
  // What the vertex stage extends by — `capsuleQuadLocal`'s own expression.
  // The "do not reintroduce" test feeds the bare halfWidth it used to use.
  vsExt = halfWidth + aaHalfPx(dpr),
) {
  const { tx, ty, nx, ny, len } = segmentFrame(p1, p2)
  const ring = quadRing(p1, p2, vsExt)
  const reach = reachFor(halfWidth, dpr)
  const N = 60
  let worst = 0
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      // Local-frame sample over the capsule plus a margin.
      const u = -(reach + 1) + (i / N) * (len + 2 * (reach + 1))
      const v = -(reach + 1) + (j / N) * 2 * (reach + 1)
      const d = distToSegmentLocal(u, v, len)
      if (d >= reach) {
        continue // fragment gives this point zero coverage
      }
      const p = { x: p1.x + tx * u + nx * v, y: p1.y + ty * u + ny * v }
      if (!insideRing(ring, p)) {
        worst = Math.max(worst, reach - d)
      }
    }
  }
  return worst
}

// Angles, lengths and widths a real plot produces. A dotplot is mostly diagonal,
// which is exactly where the derivative-based ramp this replaced was worst, so
// the diagonals are not optional cases here.
const SEGMENTS: [string, Pt, Pt][] = [
  ['horizontal', { x: 100, y: 100 }, { x: 400, y: 100 }],
  ['vertical', { x: 100, y: 100 }, { x: 100, y: 400 }],
  ['45 degrees', { x: 100, y: 100 }, { x: 400, y: 400 }],
  ['anti-diagonal', { x: 400, y: 100 }, { x: 100, y: 400 }],
  ['shallow', { x: 0, y: 300 }, { x: 800, y: 320 }],
  ['steep', { x: 300, y: 0 }, { x: 320, y: 600 }],
  ['sub-pixel (a dot)', { x: 250, y: 250 }, { x: 250.2, y: 250.1 }],
  ['exactly degenerate', { x: 250, y: 250 }, { x: 250, y: 250 }],
]

const HALF_WIDTHS = [0.25, 0.5, 1.25, 4]
const DPRS = [1, 2]

describe('dotplot capsule vertex pad', () => {
  test.each(SEGMENTS)('contains the whole shaded region: %s', (_n, p1, p2) => {
    for (const halfWidth of HALF_WIDTHS) {
      for (const dpr of DPRS) {
        expect(worstCrop(p1, p2, halfWidth, dpr)).toBe(0)
      }
    }
  })

  test('a quad that stops at halfWidth crops the ramp (do not reintroduce)', () => {
    // What the shader did before: the quad was extended by exactly halfWidth,
    // while the fragment ramped out to halfWidth + aa. Coverage reached the
    // geometry boundary at 0.5 and was cut to 0 there — a hard, aliased edge
    // around a line ~1px narrower than lineWidth.
    for (const [, p1, p2] of SEGMENTS) {
      for (const halfWidth of HALF_WIDTHS) {
        expect(worstCrop(p1, p2, halfWidth, 1, halfWidth)).toBeGreaterThan(0)
        expect(worstCrop(p1, p2, halfWidth, 1)).toBe(0)
      }
    }
  })

  // Containment alone only catches a pad that is too SMALL. A pad stated in CSS
  // px rather than device px is too large instead — 2x at dpr 1, 4x at dpr 2 —
  // and every fragment in the surplus shades to alpha 0 and is blended anyway.
  // The contract is that the two are equal, so assert equality, not coverage.
  test('the pad is exactly the reach, at every width and dpr', () => {
    for (const halfWidth of HALF_WIDTHS) {
      for (const dpr of DPRS) {
        expect(halfWidth + aaHalfPx(dpr)).toBeCloseTo(
          reachFor(halfWidth, dpr),
          9,
        )
      }
    }
  })

  test('the quad modelled here is the one the shader draws', () => {
    // Four corners, two triangles. If the shader ever emitted something other
    // than one quad per instance, every containment result above would be about
    // a shape it no longer draws.
    expect(VERTS_PER_INSTANCE).toBe(6)
    expect(quadRing({ x: 0, y: 0 }, { x: 10, y: 0 }, 1)).toHaveLength(4)
  })

  test('the ramp is one output pixel wide at any dpr', () => {
    // The property the analytic aaHalf buys over fwidth(d): the ramp is
    // 2*aaHalf CSS px = exactly one DEVICE px, at every angle. fwidth would have
    // given |ddx|+|ddy| — 1/dpr on an axis-aligned edge but sqrt(2)/dpr on a
    // diagonal — and was then used as the ramp's half-width, so the ramp came
    // out 2 to 2.83 device px and varied with the segment's angle.
    for (const dpr of DPRS) {
      const rampCssPx = 2 * (reachFor(1, dpr) - 1)
      expect(rampCssPx * dpr).toBeCloseTo(1, 9)
    }
  })
})

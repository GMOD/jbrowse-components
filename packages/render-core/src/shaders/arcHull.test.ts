// The arc hull has to cover every point the fragment paints above the band's
// anchor, or the rasterizer hard-cuts ink that no sample count is left to
// smooth — `linkMark.slang` declares `//! coverage: analytic`. Ink is sampled
// along the curve's normals, which reach every point within the pad, and each
// sample is tested against the strip's triangles as `arc.slang` and
// `linkMark.slang` emit them. The vertices come from `curveDistance.slang`'s
// own emitted twins.
import { ellipseDistance } from '../marks/ellipseDistance.ts'
import { aaHalfPx, edgeCoverage } from './antialias.js.generated.ts'
import {
  distToWideCirclePx,
  ellipseHullPoint,
  wideCircleHullPoint,
  wideCircleLeg,
  wideCircleLegStep,
} from './curveDistance.js.generated.ts'
import { LINK_CURVE_SEGMENTS } from './linkMark.consts.generated.ts'

type Pt = readonly [number, number]
type Tri = readonly [Pt, Pt, Pt]

// Float64 rounding, and the band's anchor row: `sin(PI)` leaves the far foot's
// vertices 1e-15 px off the baseline, and no pixel centre sits that low.
const EXACT = 1e-9

// `arcStrokeHalfPx` / `linkStrokeWidthPx`: no arc is thinner than 1.5 device px.
const strokeHalfPx = (dpr: number, lineWidthPx: number) =>
  Math.max(lineWidthPx, 1.5 / dpr) / 2

function inTri(p: Pt, [a, b, c]: Tri) {
  const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1])
  const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1])
  const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1])
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

// Vertex pairs in the order `vs_main` emits them, inner flank first.
function stripTriangles(pairs: (readonly [Pt, Pt])[]) {
  const verts = pairs.flat()
  const tris: Tri[] = []
  for (let i = 0; i + 2 < verts.length; i++) {
    tris.push([verts[i]!, verts[i + 1]!, verts[i + 2]!])
  }
  return tris
}

// Buckets the triangles by x so a sample tests only its neighbours.
function coverIndex(tris: Tri[]) {
  const xs = tris.flatMap(t => t.map(p => p[0]))
  const lo = Math.min(...xs)
  const width = Math.max((Math.max(...xs) - lo) / 4096, 1e-9)
  const buckets = new Map<number, Tri[]>()
  for (const t of tris) {
    const tx = t.map(p => p[0])
    const b0 = Math.floor((Math.min(...tx) - lo) / width)
    const b1 = Math.floor((Math.max(...tx) - lo) / width)
    for (let b = b0; b <= b1; b++) {
      const list = buckets.get(b) ?? []
      list.push(t)
      buckets.set(b, list)
    }
  }
  return (p: Pt) =>
    (buckets.get(Math.floor((p[0] - lo) / width)) ?? []).some(t => inTri(p, t))
}

function worstUncovered(
  covered: (p: Pt) => boolean,
  samples: Iterable<Pt>,
  alpha: (p: Pt) => number,
) {
  let worst = 0
  for (const p of samples) {
    if (!covered(p)) {
      worst = Math.max(worst, alpha(p))
    }
  }
  return worst
}

// A far leg's chords sag by thousandths of a px, so the offsets close in on
// both edges of the ink as well as crossing it.
const OFFSETS = [
  ...Array.from({ length: 21 }, (_, j) => j / 10 - 1),
  ...Array.from({ length: 24 }, (_, k) => 1 - 2 ** -(k + 1)).flatMap(t => [
    t,
    -t,
  ]),
]

function* alongNormals(
  count: number,
  pad: number,
  at: (u: number) => readonly [Pt, Pt],
  keep: (p: Pt) => boolean,
) {
  for (let i = 0; i <= count; i++) {
    const [p, n] = at(i / count)
    for (const offset of OFFSETS) {
      const t = pad * offset
      const q = [p[0] + n[0] * t, p[1] + n[1] * t] as const
      if (keep(q)) {
        yield q
      }
    }
  }
}

function worstOnDome(
  rx: number,
  ry: number,
  dpr: number,
  lineWidthPx: number,
  segs: number,
) {
  const half = strokeHalfPx(dpr, lineWidthPx)
  const pad = half + aaHalfPx(dpr)
  const h = Math.PI / (2 * segs)
  const vertex = (seg: number, flankPad: number) => {
    const a = (seg / segs) * Math.PI
    return ellipseHullPoint(
      Math.cos(a),
      Math.sin(a),
      Math.cos(h),
      Math.sin(h),
      rx,
      ry,
      flankPad,
    )
  }
  const pairs: (readonly [Pt, Pt])[] = []
  for (let seg = 0; seg <= segs; seg++) {
    pairs.push([vertex(seg, -pad), vertex(seg, pad)])
  }
  const samples = alongNormals(
    2000,
    pad,
    u => {
      const a = u * Math.PI
      const g = Math.hypot(ry * Math.cos(a), rx * Math.sin(a)) || 1
      return [
        [rx * Math.cos(a), ry * Math.sin(a)],
        [(ry * Math.cos(a)) / g, (rx * Math.sin(a)) / g],
      ]
    },
    p => p[1] > EXACT,
  )
  return worstUncovered(coverIndex(stripTriangles(pairs)), samples, p =>
    edgeCoverage(half - ellipseDistance(p[0], p[1], rx, ry), dpr),
  )
}

// Each leg in its own foot frame, which is how `vs_main` mirrors them.
function worstOnLegs(
  r: number,
  reachPx: number,
  dpr: number,
  lineWidthPx: number,
  segs: number,
) {
  const half = strokeHalfPx(dpr, lineWidthPx)
  const pad = half + aaHalfPx(dpr)
  const sweep = Math.asin(Math.min(1, (reachPx + pad) / r))
  const legs = new Map<number, (readonly [Pt, Pt])[]>()
  for (let seg = 0; seg <= segs; seg++) {
    const [side, b] = wideCircleLeg(seg, segs, sweep)
    const cosHalf = Math.cos(0.5 * wideCircleLegStep(seg, segs, sweep))
    const at = (flankPad: number) =>
      wideCircleHullPoint(Math.sin(b), Math.sin(b / 2), cosHalf, r, flankPad)
    legs.set(side, [...(legs.get(side) ?? []), [at(-pad), at(pad)]])
  }
  let worst = 0
  for (const pairs of legs.values()) {
    const samples = alongNormals(
      2000,
      pad,
      u => {
        const b = u * sweep
        return [
          [-2 * r * Math.sin(b / 2) ** 2, r * Math.sin(b)],
          [Math.cos(b), Math.sin(b)],
        ]
      },
      p => p[1] > EXACT && p[1] <= reachPx,
    )
    worst = Math.max(
      worst,
      worstUncovered(coverIndex(stripTriangles(pairs)), samples, p =>
        edgeCoverage(half - distToWideCirclePx(p[0], p[1], r), dpr),
      ),
    )
  }
  return worst
}

// Flat domes fold the inner offset at their feet, tall ones at their apex:
// `arcRadiiPx` ties ry to the band and rx to the pair, so either can win.
const DOMES = [
  [1266, 25],
  [1900, 12],
  [633, 25],
  [200, 25],
  [1266, 114],
  [3000, 8],
  [1266, 0.5],
  [40, 25],
  [10, 10],
  [10, 75],
  [1, 100],
] as const

test.each(DOMES)('a %sx%s dome covers all of its ink', (rx, ry) => {
  for (const dpr of [1, 1.5, 2]) {
    for (const lineWidthPx of [0.5, 2, 6]) {
      expect(
        worstOnDome(rx, ry, dpr, lineWidthPx, LINK_CURVE_SEGMENTS),
      ).toBeLessThan(EXACT)
    }
  }
})

test.each([32, 128])('the dome is covered at %i segments too', segs => {
  for (const [rx, ry] of DOMES) {
    expect(worstOnDome(rx, ry, 2, 1, segs)).toBeLessThan(EXACT)
  }
})

test.each([
  [1900, 150],
  [1900, 500],
  [20000, 500],
  [3e6, 150],
] as const)(
  'a far pair at r=%s through a %spx reach covers its legs',
  (r, reach) => {
    for (const dpr of [1, 2]) {
      for (const lineWidthPx of [1, 6]) {
        expect(
          worstOnLegs(r, reach, dpr, lineWidthPx, LINK_CURVE_SEGMENTS),
        ).toBeLessThan(EXACT)
      }
    }
  },
)

// A collapsed band (`arcAvailH` floors at 0) hands the dome ry 0, where the
// foot's two normals are exactly opposed.
test('a zero-height dome stays finite', () => {
  const h = Math.PI / (2 * LINK_CURVE_SEGMENTS)
  for (let seg = 0; seg <= LINK_CURVE_SEGMENTS; seg++) {
    const a = (seg / LINK_CURVE_SEGMENTS) * Math.PI
    for (const pad of [0.625, -0.625]) {
      const [x, y] = ellipseHullPoint(
        Math.cos(a),
        Math.sin(a),
        Math.cos(h),
        Math.sin(h),
        1266,
        0,
        pad,
      )
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
      expect(Math.abs(x)).toBeLessThan(1e4)
    }
  }
})

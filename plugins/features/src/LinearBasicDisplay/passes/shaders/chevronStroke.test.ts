import {
  CHEVRON_H_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
} from './chevron.consts.generated.ts'
import {
  armCoverage,
  armLocalPx,
  chevronCornerPx,
} from './chevronStroke.js.generated.ts'
import {
  CONT_STROKE_PX,
  CONT_TRI_HALF_H_PX,
  CONT_TRI_W_PX,
} from './continuation.consts.generated.ts'
import { markerHalfHeight } from './continuation.js.generated.ts'

// Holds chevronStroke.slang to the stroke its Canvas2D painters draw: the path
// base -> apex -> base at `lineWidth`, butt-capped and mitred.

interface Glyph {
  W: number
  H: number
  hw: number
}

const GLYPHS: [string, Glyph][] = [
  [
    'intron chevron',
    { W: CHEVRON_W_PX, H: CHEVRON_H_PX * 0.5, hw: CHEVRON_THICKNESS_PX * 0.5 },
  ],
  [
    'continuation marker',
    { W: CONT_TRI_W_PX, H: CONT_TRI_HALF_H_PX, hw: CONT_STROKE_PX * 0.5 },
  ],
  [
    'marker on a 2px box',
    { W: CONT_TRI_W_PX, H: markerHalfHeight(2), hw: CONT_STROKE_PX * 0.5 },
  ],
]
const DPRS = [1, 1.5, 2, 3]
const CASES = GLYPHS.flatMap(([name, g]) => DPRS.map(dpr => ({ name, g, dpr })))

// `chevronCoverage` reads the interpolated float4, outside the emitter's
// subset, so its select is restated over the generated twins. `armLocalPx` is
// affine, so evaluating it at a point is what interpolating its corner values
// gives there.
function coverage(g: Glyph, x: number, y: number, dpr: number) {
  const [upAcross, upAlong] = armLocalPx(x, y, g.W, g.H)
  const [loAcross, loAlong] = armLocalPx(x, -y, g.W, g.H)
  return upAcross > loAcross
    ? armCoverage(upAcross, upAlong, loAcross, g.hw, dpr)
    : armCoverage(loAcross, loAlong, upAcross, g.hw, dpr)
}

// Canvas2D's stroke, from its own definition rather than the twins: each arm a
// butt-capped band, the two meeting in a miter, which on each side of the axis
// is that side's band run on past the apex.
function inCanvasStroke(g: Glyph, x: number, y: number) {
  const armPx = Math.hypot(g.W, g.H)
  const yy = Math.abs(y)
  const across = (x * g.H + yy * g.W) / armPx
  const along = ((x + g.W) * g.W - (yy - g.H) * g.H) / armPx
  return Math.abs(across) <= g.hw && along >= 0
}

// The stroke's bounding box, from the same definition: the butt ends reach hw
// past the base corners and the miter hw * arm / H past the apex.
function strokeBox(g: Glyph) {
  return {
    x0: -g.W - g.hw,
    x1: (g.hw * Math.hypot(g.W, g.H)) / g.H,
    y1: g.H + g.hw,
  }
}

function triangle(g: Glyph, dpr: number) {
  return [0, 1, 2].map(k => chevronCornerPx(k, g.W, g.H, g.hw, dpr))
}

const STEP = 1 / 32

// Cell centres STEP apart over a box, a pixel wider than it on every side.
function* grid(x0: number, x1: number, y0: number, y1: number) {
  for (let x = x0 - 1; x < x1 + 1; x += STEP) {
    for (let y = y0 - 1; y < y1 + 1; y += STEP) {
      yield [x + STEP / 2, y + STEP / 2] as const
    }
  }
}

function inTriangle(t: [number, number][], x: number, y: number) {
  const side = (a: [number, number], b: [number, number]) =>
    (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])
  const s = [side(t[0]!, t[1]!), side(t[1]!, t[2]!), side(t[2]!, t[0]!)]
  return s.every(v => v >= 0) || s.every(v => v <= 0)
}

test.each(CASES)(
  "$name at dpr $dpr: the triangle's edges carry no ink, so the rasterizer cuts none",
  ({ g, dpr }) => {
    const t = triangle(g, dpr)
    let onEdges = 0
    for (let e = 0; e < 3; e++) {
      const a = t[e]!
      const b = t[(e + 1) % 3]!
      for (let s = 0; s <= 1; s += 1 / 256) {
        const x = a[0] + (b[0] - a[0]) * s
        const y = a[1] + (b[1] - a[1]) * s
        onEdges = Math.max(onEdges, coverage(g, x, y, dpr))
      }
    }
    expect(onEdges).toBeLessThan(1e-9)
  },
)

test.each(CASES)(
  "$name at dpr $dpr: the triangle holds all of Canvas2D's stroke",
  ({ g, dpr }) => {
    const t = triangle(g, dpr)
    const { x0, x1, y1 } = strokeBox(g)
    const stroke = [...grid(x0, x1, -y1, y1)].filter(([x, y]) =>
      inCanvasStroke(g, x, y),
    )
    expect(stroke.length).toBeGreaterThan(0)
    expect(stroke.filter(([x, y]) => !inTriangle(t, x, y)).slice(0, 5)).toEqual(
      [],
    )
  },
)

// Not the 2px box, whose arms overlap mid-length: there the ink is their union.
test.each(CASES.filter(c => c.g.H > 2 * c.g.hw))(
  "$name at dpr $dpr: across an arm's middle the ink is the stroke's width",
  ({ g, dpr }) => {
    const armPx = Math.hypot(g.W, g.H)
    const reach = g.hw + 0.5 / dpr
    let ink = 0
    for (let s = -reach; s < reach; s += STEP / 8) {
      const x = -g.W / 2 + (s * g.H) / armPx
      const y = g.H / 2 + (s * g.W) / armPx
      ink += coverage(g, x, y, dpr) * (STEP / 8)
    }
    expect(ink).toBeCloseTo(2 * g.hw, 3)
  },
)

test.each(CASES)(
  '$name at dpr $dpr: the apex is mitred out to where Canvas2D puts the miter',
  ({ g, dpr }) => {
    const miterPx = (g.hw * Math.hypot(g.W, g.H)) / g.H
    // A corner of two half-covered edges.
    expect(coverage(g, miterPx, 0, dpr)).toBeCloseTo(0.25, 9)
    expect(coverage(g, triangle(g, dpr)[0]![0], 0, dpr)).toBeLessThan(1e-9)
  },
)

// Over the triangle's box: the rasterizer draws nothing outside the triangle,
// whose edges carry no ink, and it holds all of Canvas2D's stroke.
test.each(CASES)(
  "$name at dpr $dpr: the ink totals Canvas2D's stroke area to within 3%",
  ({ g, dpr }) => {
    const t = triangle(g, dpr)
    const xs = t.map(p => p[0])
    const ys = t.map(p => p[1])
    let area = 0
    let ink = 0
    for (const [x, y] of grid(
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    )) {
      area += inCanvasStroke(g, x, y) ? 1 : 0
      ink += coverage(g, x, y, dpr)
    }
    expect(Math.abs(ink / area - 1)).toBeLessThan(0.03)
  },
)

// wiggle.slang splits the xyplot bar across its two stages: the vertex shader
// emits a quad grown one device pixel past each horizontal cut, and the fragment
// clips that quad back with a coverage band built from two `aaRamp`s. Two
// properties hold the pair together, neither of them unit-testable in the shader
// and neither reachable by a browser suite that does not change the display's
// `sampleCount`:
//
//   - **Every pixel the fragment inks is FULLY inside the quad.** Not merely
//     "the ramp is not cropped" — fully covered, so the rasterizer's own
//     coverage is 1 wherever the analytic alpha is non-zero and the two never
//     multiply. That is what makes the bar identical at 1 sample and at 4, which
//     is the whole reason the shader computes coverage at all.
//   - **The band's total ink is the bar's height.** A bar's top cut is the datum
//     the reader takes the score off, so the ink under it has to be the height
//     the score asks for at every sub-pixel offset — including under one device
//     pixel, where the single-ramp form this replaced over-inks.
//
// SYNC: keep in step with vs_main's `padPx` and fs_main's two-ramp band.
//
// The dotplot and synteny twins are `shaders/dotplotCapsulePad.test.ts` and
// `shaders/syntenyFillPad.test.ts`, which exist for the first property alone;
// this is the first mark in the tree whose SECOND property is the point.
//
// The import is also what makes this file a module — see the dotplot twin for
// why that matters — and ties the quad modelled here to the one the shader draws.
import { VERTS_PER_INSTANCE } from './wiggle.iface.generated.ts'

// antialias.slang. `aaPx` is the ramp's FULL width and is also what vs_main pads
// by: one device pixel, expressed in the CSS px the bar geometry is measured in.
const aaHalfPx = (dpr: number) => 0.5 / Math.max(dpr, 1)
const aaPx = (dpr: number) => 2 * aaHalfPx(dpr)
const aaRamp = (signedInk: number, widthPx: number) =>
  Math.min(Math.max(signedInk / widthPx + 0.5, 0), 1)

// fs_main, given the varying vs_main sets: `barInkPx` is (vy - topPx, vy - botPx).
function bandAlpha(vyPx: number, topPx: number, botPx: number, dpr: number) {
  const w = aaPx(dpr)
  return aaRamp(vyPx - topPx, w) - aaRamp(vyPx - botPx, w)
}

// The one-sided form the doc's option 4 proposed — top ramp, hard baseline —
// kept as the counterexample the tests below pin rather than as prose.
function topOnlyAlpha(vyPx: number, topPx: number, botPx: number, dpr: number) {
  return vyPx > botPx ? 0 : aaRamp(vyPx - topPx, aaPx(dpr))
}

// Centre of device row `r`, in CSS px. The rasterizer generates a fragment for
// this row when the centre lies inside the emitted quad.
const rowCentrePx = (r: number, dpr: number) => (r + 0.5) / dpr

interface Bar {
  topPx: number
  botPx: number
}

// Every device row the quad could possibly touch, plus a margin.
function rowsAround({ topPx, botPx }: Bar, dpr: number) {
  const lo = Math.floor((topPx - 3) * dpr)
  const hi = Math.ceil((botPx + 3) * dpr)
  const rows = []
  for (let r = lo; r <= hi; r++) {
    rows.push(r)
  }
  return rows
}

// Worst amount (in device px) by which a pixel carrying non-zero analytic alpha
// sticks out of the emitted quad. Zero means the rasterizer covers every inked
// pixel completely, so the sample count cannot change what is painted.
function worstPartialCoverage(bar: Bar, dpr: number, pad = aaPx(dpr)) {
  const quadTop = bar.topPx - pad
  const quadBot = bar.botPx + pad
  let worst = 0
  for (const r of rowsAround(bar, dpr)) {
    const centre = rowCentrePx(r, dpr)
    if (centre < quadTop || centre > quadBot) {
      continue // no fragment: the rasterizer never runs the shader here
    }
    if (bandAlpha(centre, bar.topPx, bar.botPx, dpr) <= 0) {
      continue // a fragment the pad introduced, discarded for zero ink
    }
    const pixelTop = centre - 0.5 / dpr
    const pixelBot = centre + 0.5 / dpr
    worst = Math.max(
      worst,
      (quadTop - pixelTop) * dpr,
      (pixelBot - quadBot) * dpr,
    )
  }
  return worst
}

// Total ink the band paints down one column, in device px, counting only the
// rows the rasterizer actually generates a fragment for.
function totalInk(bar: Bar, dpr: number, alpha = bandAlpha, pad = aaPx(dpr)) {
  const quadTop = bar.topPx - pad
  const quadBot = bar.botPx + pad
  let ink = 0
  for (const r of rowsAround(bar, dpr)) {
    const centre = rowCentrePx(r, dpr)
    if (centre >= quadTop && centre <= quadBot) {
      ink += alpha(centre, bar.topPx, bar.botPx, dpr)
    }
  }
  return ink
}

const DPRS = [1, 2, 3]
// Heights in DEVICE px, converted per dpr: a whole bar, a fraction of a pixel,
// and the zero-height bar a score sitting exactly on the origin produces.
const HEIGHTS_DEVICE = [0, 0.1, 0.5, 0.999, 1, 1.5, 7.3, 40]
// Sub-pixel offsets of the top cut within its device row. 0 and 0.5 are the two
// that a hard-edged rasterizer treats as special, so neither is optional.
const OFFSETS = [0, 0.1, 0.25, 0.5, 0.5001, 0.75, 0.9]

function bars(dpr: number): [string, Bar][] {
  const out: [string, Bar][] = []
  for (const h of HEIGHTS_DEVICE) {
    for (const off of OFFSETS) {
      const topPx = (30 + off) / dpr
      out.push([`h=${h} off=${off}`, { topPx, botPx: topPx + h / dpr }])
    }
  }
  return out
}

describe('xyplot bar cut coverage', () => {
  test.each(DPRS)(
    'every inked pixel is fully inside the quad at dpr %i',
    dpr => {
      for (const [, bar] of bars(dpr)) {
        expect(worstPartialCoverage(bar, dpr)).toBe(0)
      }
    },
  )

  test('half a device pixel of pad is not enough (do not reduce it)', () => {
    // The pad the dotplot capsule uses is `aaHalfPx`, half of what this needs,
    // and reaching for it here is the obvious economy. It keeps the ramp from
    // being CROPPED, so it looks right at one sample — but it leaves the top
    // fringe pixel only partly covered by the geometry, and under MSAA the
    // rasterizer's coverage multiplies the analytic alpha there. The bar then
    // renders differently at 4 samples than at 1, which is the property the
    // whole change exists to establish.
    const dpr = 2
    const offenders = bars(dpr).filter(
      ([, bar]) => worstPartialCoverage(bar, dpr, aaHalfPx(dpr)) > 0,
    )
    expect(offenders.length).toBeGreaterThan(0)
  })

  test.each(DPRS)('the band paints exactly the bar height at dpr %i', dpr => {
    for (const [name, bar] of bars(dpr)) {
      const heightDevicePx = (bar.botPx - bar.topPx) * dpr
      expect([name, totalInk(bar, dpr)]).toEqual([
        name,
        expect.closeTo(heightDevicePx, 10),
      ])
    }
  })

  test('a top ramp against a hard baseline inks a bar of zero height', () => {
    // Why both cuts ramp and not just the top. `topOnlyAlpha` applies a
    // half-plane coverage formula to a slab: correct once the bar is at least
    // one device pixel tall, and wrong under that — at zero height it paints up
    // to half a pixel of ink where it owes none, which on a wiggle full of
    // zero-scoring bins is a dotted line along the origin.
    const dpr = 2
    const zeroHeight = bars(dpr).filter(([, b]) => b.botPx === b.topPx)
    const inked = zeroHeight.filter(
      ([, b]) => totalInk(b, dpr, topOnlyAlpha) > 0,
    )
    expect(inked.length).toBeGreaterThan(0)
    for (const [, b] of zeroHeight) {
      expect(totalInk(b, dpr)).toBe(0)
    }
  })

  test('the quad modelled here is the one the shader draws', () => {
    expect(VERTS_PER_INSTANCE).toBe(6)
  })

  test('the ramp is one output pixel wide at any dpr', () => {
    for (const dpr of DPRS) {
      expect(aaPx(dpr) * dpr).toBeCloseTo(1, 12)
    }
  })
})

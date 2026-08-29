import { strokeCoverage } from './slang/alignmentsUniforms.js.generated.ts'
import * as arcFlat from './slang/arcFlat.generated.ts'
import * as linkedReadLine from './slang/linkedReadLine.generated.ts'

// The read cloud's flat connector (arcFlat.slang) and the linked-read connector
// (linkedReadLine.slang) stroke BUTT caps on Canvas2D and SVG — plain
// moveTo/lineTo with the default lineCap. Their GPU coverage inked ROUND caps
// for a while, under comments calling it butt-capped: a whole halfWidth of ink
// overhanging each endpoint that no other backend drew. This pins the cut.
//
// `buttSegmentCoverage` takes a float2, so it is outside the emitter's scalar
// subset and has no generated twin. What it is made of does — `strokeCoverage`
// is imported here, so the ramp arithmetic is the shader's own and only the
// one-line product is restated, which is the residue adr-051 accepts (the
// alternative, restating the ramp, is what makes a parity test pass against a
// shader drawing something else).
function buttSegmentCoverage(
  localX: number,
  localY: number,
  halfLenPx: number,
  halfWidthPx: number,
  dpr: number,
) {
  return (
    strokeCoverage(Math.abs(localY), halfWidthPx, dpr) *
    strokeCoverage(Math.abs(localX), halfLenPx, dpr)
  )
}

// The round-capped form these two passes used to ink, modelled here only so the
// difference can be asserted rather than described. This is render-core's
// capsule.slang, where the round cap is load-bearing for its own two consumers.
function capsuleCoverage(
  localX: number,
  localY: number,
  halfLenPx: number,
  halfWidthPx: number,
  dpr: number,
) {
  const alongPastEnd = Math.max(Math.abs(localX) - halfLenPx, 0)
  return strokeCoverage(Math.hypot(alongPastEnd, localY), halfWidthPx, dpr)
}

const HALF_LEN = 10
const HALF_WIDTH = 2

test('no ink past the endpoints — the cap is a cut, not a dome', () => {
  // One CSS px beyond the end. The capsule still paints this fully: it is
  // 1px from the segment and the stroke is 2px half-width, so it sits well
  // inside the dome. That disc of ink is precisely what no other backend drew.
  expect(capsuleCoverage(HALF_LEN + 1, 0, HALF_LEN, HALF_WIDTH, 1)).toBe(1)
  expect(buttSegmentCoverage(HALF_LEN + 1, 0, HALF_LEN, HALF_WIDTH, 1)).toBe(0)
})

test('the end is half-covered exactly at the endpoint', () => {
  // The ramp is centred on the geometry edge, so the endpoint itself is the
  // 50% sample — the same place a rasterizer puts a butt cap's edge.
  expect(buttSegmentCoverage(HALF_LEN, 0, HALF_LEN, HALF_WIDTH, 1)).toBeCloseTo(
    0.5,
    10,
  )
  expect(buttSegmentCoverage(0, 0, HALF_LEN, HALF_WIDTH, 1)).toBe(1)
})

test('the ends are exactly as soft as the sides', () => {
  // The separable product is the whole reason: one axis cannot end up with a
  // different ramp than the other, at any dpr.
  for (const dpr of [1, 1.5, 2, 3, 4]) {
    for (const t of [-0.4, -0.2, 0, 0.2, 0.4]) {
      expect(strokeCoverage(HALF_LEN + t, HALF_LEN, dpr)).toBeCloseTo(
        strokeCoverage(HALF_WIDTH + t, HALF_WIDTH, dpr),
        10,
      )
    }
  }
})

test('the quad pad covers the ramp at every dpr', () => {
  // segmentQuadLocal grows the quad by STROKE_AA_PX (1 CSS px) on both axes.
  // The ramp reaches half an output pixel past the edge, which is 0.5 CSS px
  // at dpr 1 and shrinks from there — so the pad always contains it, and the
  // coverage has reached 0 before the quad ends. Pad one without the other and
  // the ramp is clipped into a hard 50%-alpha edge.
  for (const dpr of [1, 1.5, 2, 3, 4]) {
    expect(strokeCoverage(HALF_WIDTH + 1, HALF_WIDTH, dpr)).toBe(0)
    expect(strokeCoverage(HALF_LEN + 1, HALF_LEN, dpr)).toBe(0)
  }
})

test('a degenerate span still inks its own width, not a dot', () => {
  // A zero-length butt segment is a bare cross-section: full ink at the centre
  // across the width, and nothing along. The capsule's answer here is a disc,
  // which is what a dotplot wants and a read connector does not.
  expect(buttSegmentCoverage(0, 0, 0, HALF_WIDTH, 1)).toBeCloseTo(0.5, 10)
  expect(buttSegmentCoverage(0, HALF_WIDTH, 0, HALF_WIDTH, 1)).toBeCloseTo(
    0.25,
    10,
  )
})

// The tests above pin what the butt form IS. This one pins that the two read
// connectors reach it — the wiring is the part that regressed before, and a
// numeric test of a function nothing calls would not have seen it.
test.each([
  ['arcFlat', arcFlat.WGSL_SOURCE, arcFlat.GLSL_FRAGMENT],
  ['linkedReadLine', linkedReadLine.WGSL_SOURCE, linkedReadLine.GLSL_FRAGMENT],
])('%s inks butt caps on every backend', (_name, wgsl, glsl) => {
  for (const src of [wgsl, glsl]) {
    expect(src).toContain('buttSegmentCoverage_0(')
    // The separable product, in the emitted source rather than in the .slang:
    // one ramp across the width, one along the length, multiplied.
    expect(src).toMatch(
      /return strokeCoverage_0\(abs\(\w+\.y\)[^\n]*\* strokeCoverage_0\(abs\(\w+\.x\)/,
    )
    // The round-capped distance these passes used to measure with. Its return
    // would be a dome of ink past each endpoint that no other backend draws.
    expect(src).not.toContain('sdSegment')
    expect(src).not.toContain('capsuleDist')
  }
})

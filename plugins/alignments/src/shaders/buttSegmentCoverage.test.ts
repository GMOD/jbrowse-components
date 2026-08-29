import { aaHalfPx, edgeCoverage } from '@jbrowse/render-core/shaders/antialias'

import * as arcFlat from './slang/arcFlat.generated.ts'
import * as linkedReadLine from './slang/linkedReadLine.generated.ts'

// The read cloud's flat connector (arcFlat.slang) and the linked-read connector
// (linkedReadLine.slang) stroke BUTT caps on Canvas2D and SVG — plain
// moveTo/lineTo with the default lineCap. Their GPU coverage inked ROUND caps
// for a while, under comments calling it butt-capped: a whole halfWidth of ink
// overhanging each endpoint that no other backend drew. This pins the cut.
//
// `buttSegmentCoverage` takes a float2, so it is outside the emitter's scalar
// subset and has no generated twin. What it is made of does — `edgeCoverage`
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
    edgeCoverage(halfWidthPx - Math.abs(localY), dpr) *
    edgeCoverage(halfLenPx - Math.abs(localX), dpr)
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
  return edgeCoverage(halfWidthPx - Math.hypot(alongPastEnd, localY), dpr)
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
      expect(edgeCoverage(HALF_LEN - (HALF_LEN + t), dpr)).toBeCloseTo(
        edgeCoverage(HALF_WIDTH - (HALF_WIDTH + t), dpr),
        10,
      )
    }
  }
})

test('the quad pad is exactly the ramp reach, at every dpr', () => {
  // `segmentQuadLocal` grows the quad by `aaHalfPx(dpr)` on both axes, and the
  // ramp reaches exactly that far past the ink — so the pad contains the ramp
  // and adds nothing beyond it. Both halves are failures: pad less and the
  // ramp is clipped into a hard 50%-alpha edge; pad more and every fragment in
  // the surplus shades to alpha 0 and is blended anyway. This pass padded a
  // flat 1 CSS px until 2026-08-29, which at dpr 2 is four times the reach and
  // 43% of a 1.5px connector's fragments doing nothing.
  //
  // Spelled as an equality rather than as `coverage === 0` past the pad,
  // because that form is one-sided: it passes for any pad at or above the
  // reach, which is how the over-pad survived.
  for (const dpr of [1, 1.5, 2, 3, 4]) {
    const pad = aaHalfPx(dpr)
    expect(edgeCoverage(-pad, dpr)).toBe(0)
    expect(edgeCoverage(-pad * 0.99, dpr)).toBeGreaterThan(0)
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
      /return edgeCoverage_0\([^\n]*abs\(\w+\.y\)[^\n]*\* edgeCoverage_0\([^\n]*abs\(\w+\.x\)/,
    )
    // The round-capped distance these passes used to measure with. Its return
    // would be a dome of ink past each endpoint that no other backend draws.
    expect(src).not.toContain('sdSegment')
    expect(src).not.toContain('capsuleDist')
  }
})

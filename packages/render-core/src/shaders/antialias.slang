// Shared edge-antialiasing ramps.
//
// Every GPU mark in the tree fades its edge over one OUTPUT pixel. What differs
// between shaders is how wide that is in the units the fragment measures in,
// and there are exactly two answers:
//
//   - Analytic, when the fragment's distance is a true perpendicular distance
//     in CSS px. The HAL sizes the backing store by getDpr() and sets the
//     viewport to canvas.width/height (DEVICE px) while coordinates stay CSS
//     px, so one output sample spans 1/dpr CSS px. `aaHalfPx` is that number.
//   - Measured, when it is not — a quad-local SDF whose scale differs per
//     shape, or a varying whose foreshortening the shader cannot state.
//     `aaGradient` is that number.
//
// `aaGradient` is deliberately not `fwidth`. fwidth is |ddx| + |ddy|, which
// overshoots a true gradient by up to sqrt(2), worst on the diagonals — where
// a dotplot line, a synteny ribbon edge and a chevron arm all live. The dotplot
// capsule, the synteny fill and the glyph SDFs each found that separately, in
// three plugins, before this module existed.
//
// Both ramp SHAPES are here because the tree runs both, and `aaRamp` — linear
// in the signed distance — is the one to reach for. That is not a parity
// preference. Scored against exact area coverage of a pixel by a straight edge,
// the linear ramp is closer at EVERY angle: exact on an axis-aligned edge,
// where the cubic is up to 0.096 of full ink out, and 0.043 against 0.067 worst
// case at 45 degrees. A band built as a difference of two ramps is exact at
// every width with the linear one; the cubic over-inks a half-pixel band by 37%
// (0.688 where 0.500 is the coverage). `aaSmoothRamp` is the smoothstep
// shoulder, and it reads softer because it carries more ink on both sides of
// the half-max contour, not because it resolves a curve better.
// `scripts/aa_ramp_coverage_study.ts` is the measurement.
//
// Four call sites still take the cubic: synteny's `perpCoverage` and
// `vertCoverage`, the dotplot capsule, and `glyphEdgeAlpha` — and through it
// every point glyph. Converting one moves pixels and wants the
// backend-comparison instrument, so it is a tracked change rather than a
// cleanup to do in passing; agent-docs/TODO.md carries it.
//
// The floor on `aaGradient` exists for an SDF that is a constant, such as
// manhattan's SHAPE_BAR: zero gradient makes the ramp zero-wide and the
// division 0/0. A degenerate ramp saturates to alpha 1, which is the solid fill
// those shapes want.
//! js-skip: aaRamp — the stroke antialiasing ramp, measured per fragment; Canvas2D and SVG get their edge AA from the rasterizer. Split from strokeAaRamp for the referee, not for a consumer: check-oracle sweeps by signature, so a scalar core is swept whether or not anything imports it
//! js-skip: aaSmoothRamp — the cubic form of the same per-fragment edge ramp, for the same reason
//! js-skip: aaHalfPx — half of one output pixel in CSS px, which only a fragment measuring in CSS px against a device-px grid needs; Canvas2D rasterizes in its own transform and never asks
module antialias;

// Half-width of a ramp covering exactly one output pixel, in CSS px.
// `max(dpr, 1.0)` is defensive — getDpr() never returns less — and keeps a
// bogus uniform from inverting the ramp.
public float aaHalfPx(float dpr) {
  return 0.5 / max(dpr, 1.0);
}

// One output pixel of `d`, in whatever units `d` is: the true gradient
// magnitude per device pixel. Takes derivatives, so uniform control flow only.
public float aaGradient(float d) {
  return max(length(float2(ddx(d), ddy(d))), 1e-5);
}

// Linear coverage over a ramp `widthPx` wide, centred on the edge. `signedInk`
// is positive inside the mark and zero on its boundary.
public float aaRamp(float signedInk, float widthPx) {
  return clamp(signedInk / widthPx + 0.5, 0.0, 1.0);
}

// Cubic coverage over a ramp `halfPx` to each side of the edge. Same sign
// convention as `aaRamp`; the half-width argument is what the smoothstep form
// naturally takes, so a caller holding `aaHalfPx` passes it straight through.
public float aaSmoothRamp(float signedInk, float halfPx) {
  return smoothstep(-halfPx, halfPx, signedInk);
}

// A glyph SDF's edge, measured. `coverage` is positive inside and zero on the
// edge, in whatever units the SDF uses — the gradient supplies the conversion,
// so one call covers a disc, an L1 diamond (whose gradient carries a sqrt(2)
// the others don't) and a constant-SDF bar with no per-shape constant.
//
// Callers that select between several SDFs must pick their coverage in the
// branch and call this once after it: WGSL rejects a derivative taken under a
// branch on a varying.
public float glyphEdgeAlpha(float coverage) {
  return aaSmoothRamp(coverage, 0.5 * aaGradient(coverage));
}

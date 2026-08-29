// Shared edge-antialiasing ramps.
//
// Every GPU mark in the tree fades its edge over one OUTPUT pixel. What differs
// between shaders is how wide that is in the units the fragment measures in,
// and there are exactly two answers:
//
//   - Analytic, when the fragment's distance is a true perpendicular distance
//     in CSS px. The HAL sizes the backing store by getDpr() and sets the
//     viewport to canvas.width/height (DEVICE px) while coordinates stay CSS
//     px, so one output sample spans 1/dpr CSS px. `aaPx` is that number, and
//     `edgeCoverage` is the only thing that should be spelling it.
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
// `aaRamp` — linear in the signed distance — is the shape every mark in the
// tree fades on, and that is measured rather than preferred. Scored against
// exact area coverage of a pixel by a straight edge, the linear ramp is closer
// at EVERY angle: exact on an axis-aligned edge, where the cubic is up to 0.096
// of full ink out, and 0.043 against 0.067 worst case at 45 degrees. A band
// built as a difference of two ramps is exact at every width with the linear
// one; the cubic over-inks a half-pixel band by 37% (0.688 where 0.500 is the
// coverage). `scripts/aa_ramp_coverage_study.ts` is the measurement.
//
// There WAS a second shape here, `aaSmoothRamp` — `smoothstep(-h, h, d)` — and
// it is gone rather than deprecated, because a shader function nothing calls is
// dead-code-eliminated out of every compiled shader and the js-skip check says
// so out loud. Four shaders took it: synteny's `perpCoverage` and
// `vertCoverage`, the dotplot capsule, and `glyphEdgeAlpha`, and through it
// every point glyph. It read softer on a curve, which is it carrying more ink
// on both sides of the half-max contour rather than resolving the curve better.
// Re-deriving that shape is the study's job, not this module's — it models both
// in JS and scores them, so the comparison survives the deletion.
//
// If you reintroduce a smoothstep here, note the two forms take DIFFERENT
// arguments: the smoothstep takes the HALF width where `aaRamp` takes the full.
// A conversion either way is a factor of two, and dropping it compiles.
//
// The floor on `aaGradient` exists for an SDF that is a constant, such as
// manhattan's SHAPE_BAR: zero gradient makes the ramp zero-wide and the
// division 0/0. A degenerate ramp saturates to alpha 1, which is the solid fill
// those shapes want.
// A test modelling a shader's geometry needs the ramp's reach and its shape, so
// both go to JS. Not for a Canvas2D twin — that side's rasterizer does its own
// edge AA — but because the alternative is every pad test re-spelling `0.5/dpr`
// and then agreeing with its own copy, which is what dotplotCapsulePad.test.ts
// and syntenyFillPad.test.ts each did.
//! js-export: aaPx, aaHalfPx, aaRamp, edgeCoverage
module antialias;

// Width of a ramp covering exactly one output pixel, in CSS px. THE conversion
// between the two units in this file: a fragment measuring in CSS px against a
// device-px grid asks for this and nothing else. `max(dpr, 1.0)` is defensive —
// getDpr() never returns less — and keeps a bogus uniform from inverting the
// ramp.
public float aaPx(float dpr) {
  return 1.0 / max(dpr, 1.0);
}

// Half of it: how far past the ink a ramp reaches, and so exactly how far a
// vertex stage must pad its quad to hold one. A pad stated in CSS px instead
// over-reaches by dpr — 2x on a plain monitor, 4x on a retina one — and every
// fragment in the surplus shades to alpha 0.
public float aaHalfPx(float dpr) {
  return 0.5 * aaPx(dpr);
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

// Coverage of a mark's edge for a fragment whose distance is a TRUE
// perpendicular distance in CSS px, so its gradient is analytically 1 and there
// is nothing for `aaGradient` to discover. `signedInkCssPx` is how far inside
// the ink the fragment is: positive within, zero on the boundary.
//
// One function, because there is one ramp. It carries no cap and no shape —
// a capsule, a butt-capped segment, a synteny ribbon edge and a wiggle bar all
// reduce to this once their own distance is in hand, and spelling the width
// again beside each of them is how `2.0 * aaHalfPx(dpr)` and
// `STROKE_AA_PX / max(dpr, 1.0)` came to be the same number under two
// constants, one of which no test could see double.
public float edgeCoverage(float signedInkCssPx, float dpr) {
  return aaRamp(signedInkCssPx, aaPx(dpr));
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
  return aaRamp(coverage, aaGradient(coverage));
}

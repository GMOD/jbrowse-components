// Shared round-capped stroked segment (a capsule): the quad that covers it,
// the distance that shades it, and the analytic coverage over that distance.
// The dotplot line renderer and wiggle's linecenter rendering each carried a
// full copy — one start-anchored (`clamp` along the segment), one
// center-anchored (`max(|x| - halfLen, 0)`) — algebraically the same SDF,
// joined only by a fragment comment calling the other "the same shape, and the
// same reason". Both consumers NEED the round cap: a dotplot dot is the
// degenerate cap (a segment shorter than its width grows isotropically with
// lineWidth), and linecenter's consecutive capsules share a cap centred on the
// joint vertex so its max-blend pass unions them into a seamless round join at
// any angle. Standard instanced SDF-line technique:
// https://github.com/rreusser/webgpu-instanced-lines /
// https://almarklein.org/line_rendering.html.
//
// alignments' arcFlat/linkedReadLine stroked segments are deliberately NOT
// coverage consumers: their Canvas2D/SVG twins stroke default BUTT caps, so
// their coverage is the butt form (alignmentsUniforms.slang). A cap-style flag
// here would be a mode nobody asked for twice; the two forms are two named
// coverages in their own homes.
//
// What they take instead is the FRAME, which carries no cap — `linkedReadLine`
// imports `capsuleFrame` for its diagonal. arcFlat imports nothing here at all:
// its segment is horizontal by construction, so it adds `local` to a centre and
// has no frame to orient. Said precisely because the looser version of this
// sentence ("the frame is shared") sat here while linkedReadLine still spelled
// its own copy — the same shape of untrue comment as the butt caps above.
//
// The pad is the contract between the halves: `capsuleQuadLocal` grows the
// quad by exactly the coverage ramp's reach (halfWidth + aaHalfPx(dpr)) on
// both axes, which is what lets `capsuleCoverage` use a constant analytic ramp
// instead of a derivative. Pad one without the other and the ramp is clipped
// at the quad edge, silently: coverage falls to 0.5 at the geometry boundary
// and is then cut to 0 by the rasterizer — a hard 50%-alpha edge on the
// diagonals, around a line ~1px narrower than lineWidth asked for.
// dotplotCapsulePad.test.ts models the invariant.
//
// The coverage is analytic rather than measured: `capsuleDist` is a TRUE
// Euclidean distance in CSS px, so |grad d| = 1 at every angle and one output
// pixel is `2 * aaHalfPx(dpr)` with nothing to differentiate — and d comes off
// a clamp, so at the 2x2 quads straddling the cap/body junction a derivative
// would be of a discontinuous quantity.
// `capsuleCoverage` and the degenerate threshold both go to JS, and neither is
// for a Canvas2D twin — the rasterizer does that side's AA. They are the pad
// tests' oracle: those tests model the vertex quad and the SDF in local
// helpers, because a float2 signature cannot be lifted, and the two numbers
// that decide how far the ramp reaches are exactly what a hand-written model
// gets silently wrong. `dotplotCapsulePad.test.ts` had already drifted to the
// pre-unification `1e-3` while passing, because it was checking its own copy.
// `capsuleDist` and `capsuleQuadLocal` carry no skip because they need none:
// both take or build a float2 and so are refused by the subset itself, which
// the generated inventory already reports.
//! export-consts: CAPSULE_MIN_LEN_PX
//! js-export: capsuleCoverage
module capsule;

import antialias;
import hpmath;

// Below this length a segment has no direction to speak of and `delta / len`
// is 0/0. Any positive threshold under a visible fraction of a pixel behaves
// the same (at that length the mark IS its cap); this was `1e-3` in dotplot
// and `1e-4` in the two others, and takes the majority spelling, which is also
// the one leaving the fallback the smallest reach.
public static const float CAPSULE_MIN_LEN_PX = 1e-4;

// The segment's own frame — x along it, y across it. Cap-agnostic, which is
// what lets the butt-capped linkedReadLine orient its diagonal through it. The
// degenerate guard exists only to keep a zero-length segment's 0/0 out of the
// frame.
public struct CapsuleFrame {
  public float2 tangent;
  public float2 normal;
};

public CapsuleFrame capsuleFrame(float2 delta, float len) {
  CapsuleFrame f;
  f.tangent = len > CAPSULE_MIN_LEN_PX ? delta / len : float2(1.0, 0.0);
  f.normal = float2(-f.tangent.y, f.tangent.x);
  return f;
}

// Quad corner `vid` in the segment's frame, for a capsule of half-length
// `halfLenPx` and stroke half-width `halfWidthPx`, grown by the pad the module
// header describes. Center-anchored: ±(halfLen + ext) along, ±ext across.
public float2 capsuleQuadLocal(
  uint vid, float halfLenPx, float halfWidthPx, float dpr
) {
  float ext = halfWidthPx + aaHalfPx(dpr);
  float2 q = quadLocal(vid) * 2.0 - 1.0;
  return float2(q.x * (halfLenPx + ext), q.y * ext);
}

// CSS-px distance from `local` (the segment's frame, center-anchored) to the
// segment {(-halfLen,0)..(halfLen,0)}. Collapses to distance-from-origin for a
// degenerate segment — the circular dot of radius halfWidth.
public float capsuleDist(float2 local, float halfLenPx) {
  return length(float2(max(abs(local.x) - halfLenPx, 0.0), local.y));
}

// One output pixel of linear ramp, centred on the capsule's edge.
public float capsuleCoverage(float d, float halfWidthPx, float dpr) {
  return aaRamp(halfWidthPx - d, 2.0 * aaHalfPx(dpr));
}

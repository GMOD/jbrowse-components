// A stroked segment's frame, its quad and its distance. The round cap lives in
// `capsuleDist` and nowhere else: the edge ramp over that distance is
// `antialias`'s one `edgeCoverage`, shared with every butt-capped stroke in the
// tree. Consumers, and which half each takes:
// agent-docs/reference/SHADER_SHAPE_LIBRARY.md.
//
// `capsuleQuadLocal` pads by exactly `aaHalfPx(dpr)` past the ink. Pad less and
// the ramp is clipped at the quad edge — coverage falls to 0.5 at the boundary,
// the rasterizer cuts it to 0, and the line reads a hard 50%-alpha edge about a
// pixel narrower than `lineWidth` asked for. Pad more and the surplus fragments
// shade to alpha 0.
//
// The distance is Euclidean in CSS px, so |grad d| = 1 at every angle and the
// ramp is analytic rather than differentiated — which it has to be, since `d`
// comes off a clamp and the 2x2 quads straddling the cap/body junction would be
// differentiating a discontinuity.
//! export-consts: CAPSULE_MIN_LEN_PX
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

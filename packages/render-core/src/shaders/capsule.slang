// A stroked segment's frame, its quad and its distance. The round cap lives in
// `capsuleDist` and nowhere else: the edge ramp over that distance is
// `antialias`'s one `edgeCoverage`, shared with every butt-capped stroke in the
// tree. Consumers, and which half each takes:
// agent-docs/reference/SHADER_JS_CODEGEN.md.
//
// `capsuleCorner` pads by exactly `aaHalfPx(dpr)` past the ink. Pad less and
// the ramp is clipped at the quad edge — coverage falls to 0.5 at the boundary,
// the rasterizer cuts it to 0, and the line reads a hard 50%-alpha edge about a
// pixel narrower than `lineWidth` asked for. Pad more and the surplus fragments
// shade to alpha 0.
//
// Every corner hangs off its own endpoint, and the fragment measures along the
// segment from each end rather than from the middle. A segment with one end on
// screen and the other 1e7 px away is ordinary in a zoomed-in dotplot or a
// linked read with a distant mate; anchored at the centre, its visible corners
// were `centre ± halfLen` with both terms at 1e7, and float32 put them pixels
// off. Off its endpoint, a visible corner is a small offset from a small number.
//
// The distance is Euclidean in CSS px, so |grad d| = 1 at every angle and the
// ramp is analytic rather than differentiated — which it has to be, since `d`
// comes off a clamp and the 2x2 quads straddling the cap/body junction would be
// differentiating a discontinuity.
//! export-consts: CAPSULE_MIN_LEN_PX
//! js-export: capsuleDistPx
module capsule;

import antialias;
import hpmath;

// Below this length a segment has no direction to speak of and `delta / len`
// is 0/0. Any positive threshold under a visible fraction of a pixel behaves
// the same: at that length the mark IS its cap.
public static const float CAPSULE_MIN_LEN_PX = 1e-4;

// The segment's own frame — x along it, y across it.
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

// Quad corner `vid` of the segment p1 -> p1 + deltaPx, grown by `alongPadPx`
// past each end and `acrossPadPx` either side. The caller places it at
// `(atEnd ? p2 : p1) + offsetPx` in whatever space it holds the endpoints in.
// `local` is (along from p1, along back from p2, across), the varying
// `capsuleDist` and `buttSegmentCoverage` read; both along terms are positive
// over the body and the larger one is never consulted.
public struct SegmentCorner {
  public bool atEnd;
  public float2 offsetPx;
  public float3 local;
};

public SegmentCorner segmentCorner(
  uint vid, float2 deltaPx, float alongPadPx, float acrossPadPx
) {
  float len = length(deltaPx);
  CapsuleFrame f = capsuleFrame(deltaPx, len);
  float2 q = quadLocal(vid) * 2.0 - 1.0;
  float across = q.y * acrossPadPx;
  SegmentCorner c;
  c.atEnd = q.x > 0.0;
  c.offsetPx = f.tangent * (q.x * alongPadPx) + f.normal * across;
  float far = len + alongPadPx;
  c.local = c.atEnd
    ? float3(far, -alongPadPx, across)
    : float3(-alongPadPx, far, across);
  return c;
}

// The round-capped stroke's corner: the cap is a half-width, so the pad is the
// same on both axes.
public SegmentCorner capsuleCorner(
  uint vid, float2 deltaPx, float halfWidthPx, float dpr
) {
  float ext = halfWidthPx + aaHalfPx(dpr);
  return segmentCorner(vid, deltaPx, ext, ext);
}

// The butt-capped stroke, which is what Canvas2D's default lineCap draws: the
// ink stops at each endpoint, so the pad along is the ramp's reach alone.
public SegmentCorner buttSegmentCorner(
  uint vid, float2 deltaPx, float halfWidthPx, float dpr
) {
  float aa = aaHalfPx(dpr);
  return segmentCorner(vid, deltaPx, aa, halfWidthPx + aa);
}

// Box-filter coverage of a rectangle separates per axis, so the product is
// exact and the ends are exactly as soft as the sides.
public float buttSegmentCoverage(float3 local, float halfWidthPx, float dpr) {
  return strokeCoverage(halfWidthPx, abs(local.z), dpr)
       * edgeCoverage(min(local.x, local.y), dpr);
}

// CSS-px distance from a point to the segment, given how far along it the
// point is from each end. A degenerate segment collapses to the distance from
// its one point — the circular dot of radius halfWidth. Scalar so
// `//! js-export` can lift it: the dotplot's pick measures the cursor against
// the same capsule the fragment inks, end caps included.
public float capsuleDistPx(float fromStartPx, float fromEndPx, float acrossPx) {
  float beyond = max(max(-fromStartPx, -fromEndPx), 0.0);
  return sqrt(beyond * beyond + acrossPx * acrossPx);
}

public float capsuleDist(float3 local) {
  return capsuleDistPx(local.x, local.y, local.z);
}

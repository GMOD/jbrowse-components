// The ribbon: one alignment across the circle, from its span on one genome to
// its mate's span on the other, the dotplot's segment under the polar stage.
// `x1`..`x2` is the span, `y1`..`y2` the mate's, each in genomic order on the
// unrolled axis, and `strand` says which ends pair: a forward alignment joins
// start to start, so its two curves do not cross, and a reverse one twists.
//
// One instance is a triangle strip: a cap over the span's arc, the band between
// the two curves, and a cap over the mate's arc, joined by repeated vertices.
// The band's vertices pair the curves at one parameter and grow a device half
// pixel outward across the band, and each fragment measures its distance from
// both curves across it, so a ribbon thinner than a pixel draws as the fraction
// it covers. A cap's polygon circumscribes its arc and the rim's coverage is
// measured radially, which also trims whatever of the band reaches past the
// rim.
//! targets: wgsl, glsl
//! topology: triangle-strip
//! blend: premultiplied
//! coverage: analytic

import antialias;
import colorPack;
import hpmath;
import chordStage;

public static const uint RIBBON_BAND_SEGMENTS = 32u;
public static const uint RIBBON_CAP_SEGMENTS = 8u;
static const uint CAP_VERTS = (RIBBON_CAP_SEGMENTS + 1u) * 2u;
static const uint BAND_VERTS = (RIBBON_BAND_SEGMENTS + 1u) * 2u;
// the band starts after the first cap and its two join vertices, the second
// cap after the band and two more
static const uint BAND_FIRST = CAP_VERTS + 2u;
static const uint CAP2_FIRST = BAND_FIRST + BAND_VERTS + 2u;
public static const uint VERTS_PER_INSTANCE = CAP2_FIRST + CAP_VERTS;
// what a cap reports as its band, so the band's coverage is 1 across it
static const float NO_BAND_PX = 1.0e6;

struct RibbonInstance {
  float x1      : ATTR0;
  float x2      : ATTR1;
  float y1      : ATTR2;
  float y2      : ATTR3;
  uint  xSlice  : ATTR4;
  uint  ySlice  : ATTR5;
  float strand  : ATTR6;
  uint  color   : ATTR7;
};

[[vk::binding(1, 0)]] ConstantBuffer<ChordStageUniforms> u;

struct VsOut {
  float4 position   : SV_Position;
  float4 color      : COLOR0;
  // CSS px from the circle's centre, for the rim
  float2 fromCenter : TEXCOORD0;
  // CSS px across the band from the first curve, and the band's width there
  float  across     : TEXCOORD1;
  float  bandPx     : TEXCOORD2;
  // the thin fade, one value per instance
  float  fade       : TEXCOORD3;
};

// A span's two angles grown to the floor about where it sits, in its own
// direction; a span of no width grows as a forward one does.
float2 widenedSpan(float a, float b) {
  float pad = ribbonEndPad(a, b, u.radiusPx, MIN_RIBBON_END_PX);
  float dir = b < a ? -1.0 : 1.0;
  return float2(a - dir * pad, b + dir * pad);
}

// Each end's two angles on the stage, before the floor widens them.
float4 footAngles(RibbonInstance inst) {
  return float4(
      footRadians(inst.x1, float(inst.xSlice), u.radiansPerBp, u.gapRadians),
      footRadians(inst.x2, float(inst.xSlice), u.radiansPerBp, u.gapRadians),
      footRadians(inst.y1, float(inst.ySlice), u.radiansPerBp, u.gapRadians),
      footRadians(inst.y2, float(inst.ySlice), u.radiansPerBp, u.gapRadians));
}

// The four angles the boundary visits: along the span, across to the mate,
// along the mate's span, and back.
float4 ribbonAngles(RibbonInstance inst, float4 feet) {
  float2 a = widenedSpan(feet.x, feet.y);
  float2 m = widenedSpan(feet.z, feet.w);
  float4 angles = inst.strand < 0.0 ? float4(a.x, a.y, m.x, m.y)
                                    : float4(a.x, a.y, m.y, m.x);
  return angles + u.offsetRadians;
}

// One cap vertex: pair `k` joins the chord across the arc's two ends to the
// arc itself, pushed out past the rim by the ramp's reach.
float2 capVertex(float from, float to, uint i) {
  uint k = i / 2u;
  float t = float(k) / float(RIBBON_CAP_SEGMENTS);
  if ((i & 1u) == 0u) {
    return lerp(polarPoint(u.radiusPx, from), polarPoint(u.radiusPx, to), t);
  }
  float step = abs(to - from) / float(RIBBON_CAP_SEGMENTS);
  float reach = (u.radiusPx + aaHalfPx(u.devicePixelRatio)) / cos(step * 0.5);
  return polarPoint(reach, lerp(from, to, t));
}

VsOut place(float2 p, float across, float bandPx, uint color, float fade) {
  VsOut o;
  float2 css = float2(u.centerX, u.centerY) + p;
  o.position = screenToClip(css, float2(u.canvasWidth, u.canvasHeight));
  o.color = unpackRGBA(color);
  o.fromCenter = p;
  o.across = across;
  o.bandPx = bandPx;
  o.fade = fade;
  return o;
}

[shader("vertex")]
VsOut vs_main(RibbonInstance inst, uint vid : SV_VertexID) {
  float4 feet = footAngles(inst);
  float fade = ribbonThinFade(abs(feet.y - feet.x) * u.radiusPx,
                              abs(feet.w - feet.z) * u.radiusPx,
                              MIN_RIBBON_END_PX, u.thinFadeFloor);
  float4 g = ribbonAngles(inst, feet);
  float a1 = g.x;
  float a2 = g.y;
  float m1 = g.z;
  float m2 = g.w;
  // each join repeats the vertex either side of it
  uint i = vid;
  if (i == CAP_VERTS) { i = CAP_VERTS - 1u; }
  if (i == BAND_FIRST - 1u) { i = BAND_FIRST; }
  if (i == CAP2_FIRST - 2u) { i = CAP2_FIRST - 3u; }
  if (i == CAP2_FIRST - 1u) { i = CAP2_FIRST; }

  if (i < CAP_VERTS) {
    return place(capVertex(a1, a2, i), 0.5 * NO_BAND_PX, NO_BAND_PX,
                 inst.color, fade);
  }
  if (i >= CAP2_FIRST) {
    return place(capVertex(m1, m2, i - CAP2_FIRST), 0.5 * NO_BAND_PX, NO_BAND_PX,
                 inst.color, fade);
  }
  uint b = i - BAND_FIRST;
  float t = float(b / 2u) / float(RIBBON_BAND_SEGMENTS);
  float r = u.radiusPx;
  float br = u.bezierRadiusPx;
  // the first curve leaves the span's end for the mate; the second, walked
  // backwards, leaves the span's start for the mate's other end
  float2 p0 = polarPoint(r, a2);
  float2 c0 = chordControlPoint(a2, m1, r, br);
  float2 p1 = polarPoint(r, m1);
  float2 q0 = polarPoint(r, m2);
  float2 c1 = chordControlPoint(m2, a1, r, br);
  float2 q1 = polarPoint(r, a1);
  float2 l = quadBezier(p0, c0, p1, t);
  float2 q = quadBezier(q0, c1, q1, 1.0 - t);
  // the band's own direction here, the two curves' tangents averaged: the
  // curves are paired at one parameter, which slides along them where their
  // speeds differ, so the pairing itself is no measure of the band's width
  float2 tl = quadBezierTangent(p0, c0, p1, t);
  float2 tq = -quadBezierTangent(q0, c1, q1, 1.0 - t);
  float2 ul = tl / max(length(tl), 1.0e-6);
  float2 sum = ul + tq / max(length(tq), 1.0e-6);
  float2 along = length(sum) > 1.0e-3 ? sum / length(sum) : ul;
  float2 dir = float2(-along.y, along.x);
  float signedWidth = dot(q - l, dir);
  if (signedWidth < 0.0) {
    dir = -dir;
  }
  float width = abs(signedWidth);
  float pad = aaHalfPx(u.devicePixelRatio);
  if ((b & 1u) == 0u) {
    return place(l - dir * pad, -pad, width, inst.color, fade);
  }
  return place(q + dir * pad, width + pad, width, inst.color, fade);
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  float dpr = u.devicePixelRatio;
  float band = edgeCoverage(v.across, dpr) - edgeCoverage(v.across - v.bandPx, dpr);
  float rim = edgeCoverage(u.radiusPx - length(v.fromCenter), dpr);
  float a = v.color.a * u.alpha * v.fade * clamp(band, 0.0, 1.0) * rim;
  if (a <= 0.0) discard;
  return float4(v.color.rgb * a, a);
}

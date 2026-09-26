// The chord: a link from `x` to `x2` under the polar stage, stroked along the
// curve that bows toward the centre by how far apart its ends are. One
// instance is a triangle strip hugging the curve, grown by the half stroke and
// the ramp's reach along its normal; each fragment measures its distance from
// the centre line along that normal. A chord whose ends are under a pixel apart
// collapses to one vertex and draws nothing, as the Canvas2D painter skips it.
//! targets: wgsl, glsl
//! topology: triangle-strip
//! blend: premultiplied
//! coverage: analytic

import antialias;
import colorPack;
import hpmath;
import chordStage;

public static const uint CHORD_SEGMENTS = 64u;
public static const uint VERTS_PER_INSTANCE = (CHORD_SEGMENTS + 1u) * 2u;

struct ChordInstance {
  float x       : ATTR0;
  float x2      : ATTR1;
  uint  xSlice  : ATTR2;
  uint  x2Slice : ATTR3;
  uint  color   : ATTR4;
};

[[vk::binding(1, 0)]] ConstantBuffer<ChordStageUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // CSS px from the centre line along the curve's normal
  float  across   : TEXCOORD0;
};

[shader("vertex")]
VsOut vs_main(ChordInstance inst, uint vid : SV_VertexID) {
  float a = footRadians(inst.x, float(inst.xSlice), u.radiansPerBp, u.gapRadians) + u.offsetRadians;
  float b = footRadians(inst.x2, float(inst.x2Slice), u.radiansPerBp, u.gapRadians) + u.offsetRadians;
  float r = u.radiusPx;
  float2 p0 = polarPoint(r, a);
  float2 c = chordControlPoint(a, b, r, u.bezierRadiusPx);
  float2 p1 = polarPoint(r, b);
  float t = float(vid / 2u) / float(CHORD_SEGMENTS);
  float2 tangent = quadBezierTangent(p0, c, p1, t);
  float2 normal = normalize(float2(-tangent.y, tangent.x) + float2(1.0e-6, 0.0));
  float reach = 0.5 * u.strokeWidthPx + aaHalfPx(u.devicePixelRatio);
  float side = (vid & 1u) == 0u ? -1.0 : 1.0;
  if (chordIsSpeck(a, b, r)) {
    side = 0.0;
    t = 0.0;
  }
  float2 p = quadBezier(p0, c, p1, t) + normal * side * reach;

  VsOut o;
  o.position = screenToClip(float2(u.centerX, u.centerY) + p,
                            float2(u.canvasWidth, u.canvasHeight));
  o.color = unpackRGBA(inst.color);
  o.across = side * reach;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  float cov = edgeCoverage(0.5 * u.strokeWidthPx - abs(v.across), u.devicePixelRatio);
  float a = v.color.a * u.alpha * cov;
  if (a <= 0.0) discard;
  return float4(v.color.rgb * a, a);
}

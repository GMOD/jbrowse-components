// LD heatmap — UNIFORM mode. Instance data is just ldValue; (i, j)
// coordinates within the triangular grid come from `instance_index`
// decoded via the inverse-triangular-number formula. Cell pitch is
// `uniformW` (shared across all cells).
//! targets: wgsl, glsl

import ldUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
static const float ROT_45 = 0.7071067811865476;

struct LDInstance {
  float ldValue : ATTR0;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  float  ldValue  : COLOR0;
};

[shader("vertex")]
VsOut vs_main(
  LDInstance inst,
  uint vid : SV_VertexID,
  uint iid : SV_InstanceID,
) {
  // Inverse triangular number: for instance index idx, find (i, j) such that
  // idx = i*(i-1)/2 + j. Using the positive root of the quadratic gives `i`.
  float fi = (1.0 + sqrt(1.0 + 8.0 * float(iid))) * 0.5;
  uint i = uint(fi);
  uint j = iid - (i * (i - 1u)) / 2u;

  float2 pos = (float2(float(j), float(i)) + quadLocal(vid)) * u.uniformW;

  float rx = (pos.x + pos.y) * ROT_45;
  float ry = (-pos.x + pos.y) * ROT_45;
  float sx = rx * u.viewScale + u.viewOffsetX;
  float sy = ry * u.viewScale * u.yScalar;

  VsOut o;
  o.position = float4(
    (sx / u.canvasSize.x) * 2.0 - 1.0,
    1.0 - (sy / u.canvasSize.y) * 2.0,
    0.0, 1.0);
  o.ldValue = inst.ldValue;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float t = (u.signedLd == 1u) ? (fragIn.ldValue + 1.0) * 0.5 : fragIn.ldValue;
  t = clamp(t, 0.0, 1.0);
  float4 c = colorRamp.SampleLevel(float2(t, 0.5), 0.0);
  return float4(c.rgb * c.a, c.a);
}

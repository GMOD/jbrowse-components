// LD heatmap — UNIFORM mode. Instance data is just ldValue; (i, j)
// coordinates within the triangular grid come from `instance_index` decoded
// via decodeTriangular. Cell pitch is `uniformW` (shared across all cells).
//! targets: wgsl, glsl

import ldUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;

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
  uint2 ij = decodeTriangular(iid);
  float2 pos = (float2(float(ij.y), float(ij.x)) + quadLocal(vid)) * u.uniformW;

  VsOut o;
  o.position = ldCellToClip(pos, u);
  o.ldValue = inst.ldValue;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return ldRampColor(fragIn.ldValue, u, colorRamp);
}

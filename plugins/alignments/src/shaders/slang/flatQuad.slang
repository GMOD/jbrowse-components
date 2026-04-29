// Flat-quad overlay pass: each instance draws a single colored rect in
// clip-space coordinates. Used for feature / chain highlight frames.
//! targets: wgsl, glsl

import alignmentsUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  float sx1   : ATTR0;
  float syTop : ATTR1;
  float sx2   : ATTR2;
  float syBot : ATTR3;
  float4 rgba : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);
  o.position = float4(
    lerp(inst.sx1, inst.sx2, local.x),
    lerp(inst.syBot, inst.syTop, local.y),
    0.0, 1.0);
  o.color = inst.rgba;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

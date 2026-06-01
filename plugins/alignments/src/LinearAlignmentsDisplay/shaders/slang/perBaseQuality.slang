// Per-base-quality pass: one 1bp-wide quad per aligned base, colored by a
// per-instance ABGR u32 packed on the main thread (features/perBaseQuality/
// colors.ts) so GPU and Canvas2D share the exact color ramp. Same instance
// shape as the modification pass.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint position    : ATTR0;
  uint y           : ATTR1;
  uint packedColor : ATTR2;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float2 xx = expandMinWidthX(
    hpClipX(hpSplitUint(inst.position), u),
    hpClipX(hpSplitUint(inst.position + 1u), u),
    u.canvasW);
  float sx1 = xx.x;
  float sx2 = xx.y;

  float2 yy = pileupY(float(inst.y), u);
  o.position = float4(flipX(lerp(sx1, sx2, local.x), u), lerp(yy.y, yy.x, local.y), 0.0, 1.0);
  o.color = unpackRGBA(inst.packedColor);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

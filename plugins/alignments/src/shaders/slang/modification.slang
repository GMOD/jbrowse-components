// Base-modification pass: per-instance ABGR color packed in a u32, so
// modification types / strengths don't require palette lookups in the UBO.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;

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

  float sx1 = hpClipX(hpSplitUint(inst.position), u);
  float sx2 = hpClipX(hpSplitUint(inst.position + 1u), u);
  float minW = 2.0 / u.canvasW;
  if (sx2 - sx1 < minW) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minW * 0.5;
    sx2 = mid + minW * 0.5;
  }

  float2 yy = pileupY(float(inst.y), u);
  o.position = float4(flipX(lerp(sx1, sx2, local.x), u), lerp(yy.y, yy.x, local.y), 0.0, 1.0);
  o.color = unpackRGBA(inst.packedColor);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

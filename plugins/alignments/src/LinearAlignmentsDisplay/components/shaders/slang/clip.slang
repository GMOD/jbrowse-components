// Clip pass (soft + hard combined): draws a thin colored bar at a clip
// boundary. `kind` = 0 → use u.colorSoftclip, `kind` = 1 → u.colorHardclip.
// Bar width = max(bpPerPx, min(bpPerPx, 1)) so it stays visible at any zoom.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  uint  y         : ATTR1;
  uint  length    : ATTR2;
  float frequency : ATTR3;
  uint  kind      : ATTR4;  // 0 = softclip, 1 = hardclip
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float pxPerBp = u.canvasW / u.bpLen;

  float alpha = 1.0;
  if (pxPerBp < 1.0) {
    alpha = pxPerBp + inst.frequency * (1.0 - pxPerBp);
  }
  if (alpha <= 0.0) {
    o.position = float4(0.0);
    o.color = float4(0.0);
    return o;
  }

  float clipCx = hpClipX(hpSplitUint(inst.position), u);
  float bpPerPx = 1.0 / pxPerBp;
  float barW = max(bpPerPx, min(bpPerPx, 1.0));
  float halfWClip = (barW * 0.5 / u.bpLen) * 2.0;
  float sx1 = clipCx - halfWClip;
  float sx2 = clipCx + halfWClip;
  float minW = 2.0 / u.canvasW;
  if (sx2 - sx1 < minW) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minW * 0.5;
    sx2 = mid + minW * 0.5;
  }

  float2 yy = pileupY(float(inst.y), u);
  o.position = float4(flipX(lerp(sx1, sx2, local.x), u), lerp(yy.y, yy.x, local.y), 0.0, 1.0);
  float3 c = (inst.kind == 0u) ? unpackRGBA(u.colorSoftclip).xyz : unpackRGBA(u.colorHardclip).xyz;
  o.color = float4(c, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

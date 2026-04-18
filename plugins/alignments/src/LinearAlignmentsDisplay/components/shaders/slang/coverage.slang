// Coverage pass: one bar per coverage bin, colored with the palette's
// coverage color. Bar height is `depth * depthScale * effectiveHeight`.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  float position : ATTR0;
  float depth    : ATTR1;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float dw = u.domainEnd - u.domainStart;
  float2 dom = float2(u.domainStart, u.domainEnd);
  float x1 = (inst.position - dom.x) / dw * 2.0 - 1.0;
  float x2 = (inst.position + u.binSize - dom.x) / dw * 2.0 - 1.0;
  float minW = 2.0 / u.canvasW;
  if (x2 - x1 < minW) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minW * 0.5;
    x2 = mid + minW * 0.5;
  }

  float eh = effHeight(u);
  float bottom = covBottom(u);
  float barTop = bottom + (inst.depth * u.depthScale * eh / u.canvasH) * 2.0;
  o.position = float4(
    flipX(lerp(x1, x2, local.x), u),
    lerp(bottom, barTop, local.y),
    0.0, 1.0);
  o.color = float4(unpackRGBA(u.colorCoverage).xyz, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

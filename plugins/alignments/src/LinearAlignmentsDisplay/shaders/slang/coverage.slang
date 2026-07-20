// Coverage pass: one bar per coverage bin, colored with the palette's
// coverage color. Bar height is normalizeDepth(depth, u) * effectiveHeight.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/coverageLayout.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position : ATTR0;
  float depth    : ATTR1;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float2 xx = expandMinWidthX(
    bpToClipX(inst.position, u),
    bpToClipX(inst.position + uint(u.binSize), u),
    u.canvasW);
  float x1 = xx.x;
  float x2 = xx.y;

  float bottom = covBottom(u);
  float barTop = bottom + covBarScale(inst.depth, u);
  o.position = float4(
    flipX(lerp(x1, x2, local.x), u),
    lerp(bottom, barTop, local.y),
    0.0, 1.0);
  o.color = float4(unpackRGBA(u.colorCoverage).xyz, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}

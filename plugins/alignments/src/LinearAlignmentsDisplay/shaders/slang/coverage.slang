// Coverage pass: one bar per coverage bin, colored with the palette's
// coverage color. Bar height is normalizeDepth(depth, u) * effectiveHeight.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/coverageLayout.generated.ts
// The band geometry is authored in alignmentsUniforms, but lifted from HERE:
// a module is dead-code-eliminated down to nothing, and this pass is the one
// that reaches both functions off its draw path. The twin lands in
// @jbrowse/alignments-core because that is where the Canvas2D coverage
// painters live, and they cannot depend on this plugin.
//! js-export: covEffectiveHeightPx, covBottomOffsetPx
//! js-export-out: packages/alignments-core/src/coverageBandLayout.generated.ts

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
  o.position = flippedQuadPos(x1, x2, bottom, barTop, local, u);
  o.color = float4(unpackRGBA(u.colorCoverage).xyz, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}

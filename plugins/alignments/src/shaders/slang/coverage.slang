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

// `relDepth` is depths[bin] / regionMaxDepth, the same packing the SNP and
// modification segments carry (see snpCoverage.slang) — normalizeDepth recovers
// the raw depth from it. The bin spans `u.binSize` bp: 1 for per-bp coverage,
// wider once the worker downsamples (packCoverageArea).
struct Instance {
  uint  position : ATTR0;
  float relDepth : ATTR1;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  // The whole bar: y span 0..1 of itself. Same quad the segments stack inside.
  o.position = covSegQuad(inst.position, uint(u.binSize), 0.0, 1.0,
                          inst.relDepth, quadLocal(vid), u);
  o.color = float4(unpackRGBA(u.colorCoverage).xyz, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}

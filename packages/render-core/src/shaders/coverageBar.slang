// Coverage-band depth bars: one bar per coverage bin, filled with the palette's
// coverage color. Bar height is covNormalizeDepth(relDepth) * the band's
// drawable height. Shared by the alignments pileup band and the MAF band — see
// coverageBand.slang.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/coverageLayout.generated.ts
// hpmath's midpoint min-width rule, lifted from the pass that draws through it
// (covSegQuad -> covExpandMinWidthX). It is authored in a module whose own
// js-export-out redirect is spoken for, and its twin is wanted in
// @jbrowse/alignments-core, which cannot import render-core — the case adr-051
// keeps "a shader may export a function it only imports" for. Consumer:
// `fillSpanRect`, the one Canvas2D spelling the band and the pileup's span
// marks share.
//! js-export: expandToMinWidthPx
//! js-export-out: packages/alignments-core/src/spanMinWidth.generated.ts

import coverageBand;
import colorPack;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<CoverageBandUniforms> u;

// `relDepth` is depths[bin] / regionMaxDepth, the same packing the SNP and
// modification segments carry (see coverageSnp.slang) — covNormalizeDepth
// recovers the raw depth from it. The bin spans `u.binSize` bp: 1 for per-bp
// coverage, wider once the producer downsamples.
struct Instance {
  uint  position : ATTR0;
  float relDepth : ATTR1;
};

[shader("vertex")]
CoverageVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  CoverageVsOut o;
  // The whole bar: y span 0..1 of itself. Same quad the segments stack inside.
  o.position = covSegQuad(inst.position, uint(u.binSize), 0.0, 1.0,
                          inst.relDepth, quadLocal(vid), u);
  o.color = float4(unpackRGBA(u.colorCoverage).xyz, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(CoverageVsOut fragIn) : SV_Target {
  return fragIn.color;
}

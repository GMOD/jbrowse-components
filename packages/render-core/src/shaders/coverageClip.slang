// The coverage band's clip strips: `CLIP_STRIP_PX` of red across the top of
// every depth bar whose depth the domain cut (ADR-183). Its own pass off the
// depth bars' buffer, drawn last, since the SNP, modification and interbase
// layers stack inside the bar and would paint over a strip drawn with it.
// `drawCoverageClipStrips` in @jbrowse/alignments-core is the Canvas2D twin.
//! targets: wgsl, glsl

import coverageBand;
import colorPack;
import clipStrip;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<CoverageBandUniforms> u;

[shader("vertex")]
CoverageVsOut vs_main(CoverageBarInstance inst, uint vid : SV_VertexID) {
  float rawDepth = inst.relDepth * u.regionMaxDepth;
  if (clipSide(rawDepth, u.depthDomainMin, u.depthDomainMax, u.coverageScaleType) != 1) {
    return covDiscardVertex();
  }
  float2 xx = covExpandMinWidthX(
    covBpToClipX(inst.position, u), covBpToClipX(inst.position + uint(u.binSize), u), u.canvasW);
  float topPx = covBaselinePx(u) - covEffHeight(u);
  CoverageVsOut o;
  o.position = covFlippedQuad(
    xx.x, xx.y,
    yPxToClipY(topPx + CLIP_STRIP_PX, u.canvasH),
    yPxToClipY(topPx, u.canvasH),
    quadLocal(vid), u);
  o.color = float4(unpackRGBA(CLIP_STRIP_COLOR).xyz, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(CoverageVsOut fragIn) : SV_Target {
  return fragIn.color;
}

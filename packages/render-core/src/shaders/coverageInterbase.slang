// Interbase histogram: slim 1px-wide bars indicating insertion / softclip /
// hardclip density across the coverage band, hanging from the band top so each
// bar runs out of its indicator triangle's apex. See coverageBand.slang.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/interbaseHistogramLayout.generated.ts
//! js-export: interbaseEdgePx
//! js-export-out: packages/alignments-core/src/interbaseEdge.generated.ts

import coverageBand;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<CoverageBandUniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float yOffset   : ATTR1;
  float segHeight : ATTR2;
  float colorType : ATTR3;  // 1=insertion 2=softclip 3=hardclip
};

// Screen-pixel Y of one edge of a bar, `offset` bars' worth of stacked height
// below the coverage-area top, snapped to a whole pixel. The backends disagree
// on a half-covered row: Canvas2D saturates the ~40 bars stacked in one column
// at 40bp/px to opaque, while this pass resolves their union once and stays at
// 50%. drawInterbaseSegments `//! js-export`s this so both sides round alike.
float interbaseEdgePx(float offset, float interbaseHeight) {
  return floor(offset * interbaseHeight + 0.5);
}

[shader("vertex")]
CoverageVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  CoverageVsOut o;
  float2 local = quadLocal(vid);

  float cx = covBpToClipX(inst.position, u);
  float barW = pxToClipLen(1.0, u.canvasW);

  // Both edges snap to whole pixels BEFORE the clip-space conversion.
  float topPx = interbaseEdgePx(inst.yOffset, u.interbaseHeight);
  float botPx = interbaseEdgePx(inst.yOffset + inst.segHeight, u.interbaseHeight);
  float sTop = covAreaTop(u) - pxToClipLen(topPx, u.canvasH);
  float sBot = covAreaTop(u) - pxToClipLen(botPx, u.canvasH);

  o.position = covFlippedQuad(cx - barW * 0.5, cx + barW * 0.5, sBot, sTop, local, u);
  o.color = float4(covClipKindColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(CoverageVsOut fragIn) : SV_Target {
  return fragIn.color;
}

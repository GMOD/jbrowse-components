// Interbase histogram: slim 1px-wide bars indicating insertion / softclip /
// hardclip density across the coverage band, hanging from the indicator
// triangles' tip row. See coverageBand.slang.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/interbaseHistogramLayout.generated.ts
//! js-export: interbaseEdgePx, interbaseBarLeftPx
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
//
// The bar starts on the row holding the triangle's tip, floor(TRIANGLE_H),
// rather than the row after it: the tip covers only a sliver of that row, so
// starting below it leaves a visible gap between triangle and bar.
float interbaseEdgePx(float offset, float interbaseHeight) {
  return floor(TRIANGLE_H) + floor(offset * interbaseHeight + 0.5);
}

// Left edge of the 1px bar centred on `centerPx`, snapped to the pixel column
// whose centre is nearest. Unsnapped, the bar straddles two columns: Canvas2D
// paints both at partial alpha while the GPU fills one solid, so the bar read
// paler than its triangle and the backends disagreed.
float interbaseBarLeftPx(float centerPx) {
  return floor(centerPx);
}

[shader("vertex")]
CoverageVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  CoverageVsOut o;
  float2 local = quadLocal(vid);

  float cx = covFlipX(covBpToClipX(inst.position, u), u);
  float x0 = pxToClipX(interbaseBarLeftPx(clipXToPx(cx, u.canvasW)), u.canvasW);
  float x1 = x0 + pxToClipLen(1.0, u.canvasW);

  // Both edges snap to whole pixels BEFORE the clip-space conversion.
  float topPx = interbaseEdgePx(inst.yOffset, u.interbaseHeight);
  float botPx = interbaseEdgePx(inst.yOffset + inst.segHeight, u.interbaseHeight);
  float sTop = covAreaTop(u) - pxToClipLen(topPx, u.canvasH);
  float sBot = covAreaTop(u) - pxToClipLen(botPx, u.canvasH);

  o.position = float4(lerp(x0, x1, local.x), lerp(sBot, sTop, local.y), 0.0, 1.0);
  o.color = float4(covClipKindColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(CoverageVsOut fragIn) : SV_Target {
  return fragIn.color;
}

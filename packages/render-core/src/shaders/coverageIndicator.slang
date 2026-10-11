// Indicator triangles: a single 7x4.5px triangle per instance pinned to the top
// of the coverage band, marking an insertion / softclip / hardclip site whose
// histogram bar hangs below it. Barycentric coords in the fragment shader give
// cheap diagonal-edge anti-aliasing. See coverageBand.slang.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/indicatorLayout.generated.ts

import coverageBand;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 3u;
// TRIANGLE_HW / TRIANGLE_H come from coverageBand — coverageInterbase hangs its
// bars below this triangle and must use the same height.

[[vk::binding(1, 0)]] ConstantBuffer<CoverageBandUniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float colorType : ATTR1;  // 1=insertion 2=softclip 3=hardclip
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float3 bary     : COLOR1;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  uint v = vid % 3u;

  float cx = covBpToClipX(inst.position, u);
  float tw = pxToClipLen(TRIANGLE_HW * 2.0, u.canvasW);  // full triangle width
  float th = pxToClipLen(TRIANGLE_H, u.canvasH);

  float top = covAreaTop(u);
  float sx, sy;
  if (v == 0u)      { sx = cx - tw * 0.5; sy = top;      o.bary = float3(1.0, 0.0, 0.0); }
  else if (v == 1u) { sx = cx + tw * 0.5; sy = top;      o.bary = float3(0.0, 1.0, 0.0); }
  else              { sx = cx;            sy = top - th; o.bary = float3(0.0, 0.0, 1.0); }

  o.position = float4(covFlipX(sx, u), sy, 0.0, 1.0);
  o.color = float4(covClipKindColor(inst.colorType, u), 1.0);
  return o;
}

// Barycentric -> approximate px distance from each diagonal edge, for the
// smoothstep fade below. NOT the triangle's altitude despite the round number:
// for the 7x4.5 triangle that is 7*4.5/hypot(3.5, 4.5) = 5.53px, so this scale
// spreads the fade over ~1.5px rather than 1px. Left as-is — it is a softness
// knob, and tightening it visibly sharpens every indicator.
static const float EDGE_FADE_SCALE_PX = 3.7;

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float dLeft = fragIn.bary.y * EDGE_FADE_SCALE_PX;
  float dRight = fragIn.bary.x * EDGE_FADE_SCALE_PX;
  float aa = smoothstep(0.0, 1.0, min(dLeft, dRight));
  return float4(fragIn.color.rgb, fragIn.color.a * aa);
}

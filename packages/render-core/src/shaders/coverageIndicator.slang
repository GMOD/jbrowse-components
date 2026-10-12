// Indicator triangles: a single 7x4.5px triangle per instance pinned to the top
// of the coverage band, marking an insertion / softclip / hardclip site whose
// histogram bar hangs below it. Each instance is a quad padded past the
// triangle and shaded by edge coverage, so the ink, tip included, matches
// Canvas2D's `drawIndicatorTriangle`. See coverageBand.slang.
//! targets: wgsl, glsl
//! coverage: analytic
//! layout-out: packages/alignments-core/src/indicatorLayout.generated.ts

import antialias;
import coverageBand;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;
static const float PAD_PX = 1.0;

[[vk::binding(1, 0)]] ConstantBuffer<CoverageBandUniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float colorType : ATTR1;  // 1=insertion 2=softclip 3=hardclip
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // CSS px from the triangle's top centre, y pointing down.
  float2 local    : COLOR1;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 corner = quadLocal(vid);
  o.local = float2(
    lerp(-TRIANGLE_HW - PAD_PX, TRIANGLE_HW + PAD_PX, corner.x),
    lerp(TRIANGLE_H + PAD_PX, -PAD_PX, corner.y)
  );

  float cx = covFlipX(covBpToClipX(inst.position, u), u);
  o.position = float4(
    cx + pxToClipLen(o.local.x, u.canvasW),
    covAreaTop(u) - pxToClipLen(o.local.y, u.canvasH),
    0.0,
    1.0
  );
  o.color = float4(covClipKindColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float2 p = fragIn.local;
  float slantInk = (TRIANGLE_H * (TRIANGLE_HW - abs(p.x)) - TRIANGLE_HW * p.y)
    / length(float2(TRIANGLE_HW, TRIANGLE_H));
  float aa = aaRamp(min(p.y, slantInk), aaGradient(p.y));
  return float4(fragIn.color.rgb, fragIn.color.a * aa);
}

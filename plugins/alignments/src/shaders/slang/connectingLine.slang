// Linked-read connecting line: a 1px horizontal hairline between each pair of
// mates in a chain, in the theme's foreground, on the pixel row the intron line
// also uses.
//! targets: wgsl, glsl
//! export-consts: CONNECTING_LINE_ALPHA

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;

// Tint strength of the connector. Exported so features/connectingLines/
// mark.ts (Canvas2D + SVG export) strokes at the same opacity.
static const float CONNECTING_LINE_ALPHA = 0.45;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  startOff : ATTR0;
  uint  endOff   : ATTR1;
  float y        : ATTR2;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float sx1 = bpToClipX(inst.startOff, u);
  float sx2 = bpToClipX(inst.endOff, u);

  float2 yy = pileupCenterlineY(inst.y, u);

  o.position = flippedQuadPos(sx1, sx2, yy.y, yy.x, local, u);
  o.color = float4(unpackRGBA(u.colorConnectingLine).xyz, CONNECTING_LINE_ALPHA);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}

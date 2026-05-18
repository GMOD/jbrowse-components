// Linked-read connecting line for `linkedReadBezier` mode. Per-instance
// 2-vertex line-list quad with per-endpoint Y (mates can sit on different
// rows when sortedBy is in effect) and palette-indexed color (8 slots, see
// `linkedReadColor*` in alignmentsUniforms.slang).
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 2u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  bp1       : ATTR0;
  uint  bp2       : ATTR1;
  float y1        : ATTR2;
  float y2        : ATTR3;
  float colorType : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float3 linkedReadColorByIndex(uint idx, Uniforms u) {
  uint colors[8];
  colors[0] = u.linkedReadColor0; colors[1] = u.linkedReadColor1;
  colors[2] = u.linkedReadColor2; colors[3] = u.linkedReadColor3;
  colors[4] = u.linkedReadColor4; colors[5] = u.linkedReadColor5;
  colors[6] = u.linkedReadColor6; colors[7] = u.linkedReadColor7;
  return unpackRGBA(colors[min(idx, 7u)]).xyz;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  uint v = vid % 2u;

  uint bp = (v == 0u) ? inst.bp1 : inst.bp2;
  float y = (v == 0u) ? inst.y1 : inst.y2;

  float sx = hpClipX(hpSplitUint(bp), u);
  float rowH = u.featHeight + u.featSpacing;
  float rowCenter = u.covOffset + y * rowH + u.featHeight * 0.5 - u.scrollTop;
  float px2clip = 2.0 / u.canvasH;
  float sy = 1.0 - rowCenter * px2clip;

  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  uint idx = uint(inst.colorType + 0.5);
  o.color = float4(linkedReadColorByIndex(idx, u), 0.8);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

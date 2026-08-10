// Linked-read connecting line for `linkedReadBezier` mode. Per-instance
// 2-vertex line-list quad with per-endpoint Y (mates can sit on different
// rows when sortedBy is in effect) and palette-indexed color (8 slots, see
// `linkedReadColor*` in alignmentsUniforms.slang).
//! targets: wgsl, glsl
//! export-consts: LINKED_READ_LINE_ALPHA

import alignmentsUniforms;
import colorPack;


public static const uint VERTS_PER_INSTANCE = 2u;

// Connector opacity: the lines cross the pileup, so they stay translucent enough
// to read the reads underneath. Exported so features/linkedReads/drawCanvas.ts
// (Canvas2D + SVG export) strokes the same alpha.
static const float LINKED_READ_LINE_ALPHA = 0.8;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  bp1       : ATTR0;
  uint  bp2       : ATTR1;
  float y1        : ATTR2;
  float y2        : ATTR3;
  float colorType : ATTR4;
};

// linkedReadColorSlot (alignmentsUniforms) is the index rule, split out so the
// Canvas2D/SVG overlay can read the generated twin instead of spelling its own.
float3 linkedReadColorByIndex(uint idx, Uniforms u) {
  return u.linkedReadColor[linkedReadColorSlot(idx)].xyz;
}

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  uint v = vid % 2u;

  uint bp = (v == 0u) ? inst.bp1 : inst.bp2;
  float y = (v == 0u) ? inst.y1 : inst.y2;

  float sx = bpToClipX(bp, u);
  float px2clip = 2.0 / u.canvasH;
  float sy = 1.0 - pileupRowCenterPx(y, u) * px2clip;

  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  uint idx = uint(inst.colorType + 0.5);
  o.color = float4(linkedReadColorByIndex(idx, u), LINKED_READ_LINE_ALPHA);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}

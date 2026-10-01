// One cell of the reference sequence stack: a base, a codon, or the partial
// codon at a region's edge, filled across [x, x2) on its row. Once letters
// show, a bordered cell also draws its half of the 1px line Canvas2D's
// `strokeRect` centres on each edge, at the coverage that stroke gives a
// pixel; the neighbour draws the other half.
//! targets: wgsl, glsl
//! instance-writer
//! export-consts: CELL_BORDER_PX

import colorPack;
import hpmath;
import rowRect;

public static const uint VERTS_PER_INSTANCE = 6u;

static const float CELL_BORDER_PX = 1.0;

struct SequenceCellInstance {
  uint x        : ATTR0;
  uint x2       : ATTR1;
  uint row      : ATTR2;
  uint color    : ATTR3;
  uint bordered : ATTR4;
};

struct SequenceCellUniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  viewportWidth;
  float  zero;
  float  rowHeight;
  uint   showBorders;
  uint   borderColor;
};
[[vk::binding(1, 0)]] ConstantBuffer<SequenceCellUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPx  : COLOR1;
  nointerpolation float2 sizePx   : COLOR2;
  nointerpolation uint   bordered : COLOR3;
};

[shader("vertex")]
VsOut vs_main(SequenceCellInstance inst, uint vid : SV_VertexID) {
  RowRectUniforms r;
  r.bpRangeX       = u.bpRangeX;
  r.canvasHeight   = u.canvasHeight;
  r.minCellDenomPx = u.viewportWidth;
  r.minCellPx      = 0.0;
  r.zero           = u.zero;
  r.rowHeight      = u.rowHeight;
  r.rowProportion  = 1.0;
  r.scrollTop      = 0.0;

  float sx1 = hpToClipX(hpSplitUint(inst.x), u.bpRangeX, u.zero);
  float sx2 = hpToClipX(hpSplitUint(inst.x2), u.bpRangeX, u.zero);
  float2 size = float2(clipLenToPx(abs(sx2 - sx1), u.viewportWidth), u.rowHeight);

  VsOut o;
  o.position = rowRectClipPos(inst.x, inst.x2, float(inst.row), vid, r);
  o.color    = unpackRGBA(inst.color);
  o.localPx  = quadLocal(vid) * size;
  o.sizePx   = size;
  o.bordered = inst.bordered & u.showBorders;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  // derivatives before the branch: `bordered` varies per instance
  float2 cssPerDevicePx = max(fwidth(v.localPx), float2(1e-6));
  if (v.bordered == 0u) {
    return v.color;
  }
  float2 edge = min(v.localPx, v.sizePx - v.localPx);
  float2 cover = saturate((CELL_BORDER_PX * 0.5 - edge) / cssPerDevicePx + 0.5);
  return lerp(v.color, unpackRGBA(u.borderColor), max(cover.x, cover.y));
}

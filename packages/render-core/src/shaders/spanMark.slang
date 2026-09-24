// The `span` mark shape: one instance is a coloured rectangle spanning
// [x, x2) in absolute genomic coords, on the row band given by the `row`
// channel. The geometry — row band, hp clip-x span, min-width widening — is
// `rowRect`'s; this is the entry point that makes it a pass a mark can draw.
//
// `row` is read through the bound row table (`rowTable`): a key resolved to
// its drawn slot and colour, or collapsed to a zero-area quad off clip space
// where the table hides it. A pass binding no table (`rowTableKeys` −1) draws
// `row` as the slot, which is what every consumer did before the table.
//! targets: wgsl, glsl
//! instance-writer

import colorPack;
import rowRect;
import rowTable;

public static const uint VERTS_PER_INSTANCE = 6u;

struct SpanMarkUniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  minCellDenomPx;
  float  minCellPx;
  float  zero;
  float  rowHeight;
  float  rowProportion;
  float  scrollTop;
  int    rowTableKeys;
};

[[vk::binding(1, 0)]] ConstantBuffer<SpanMarkUniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> rowTable;

[shader("vertex")]
RowRectVsOut vs_main(RowRectInstance inst, uint vid : SV_VertexID) {
  RowPlacement p = rowTableLookup(
    rowTable, inst.row, u.rowTableKeys, unpackRGBA(inst.color));
  RowRectVsOut o;
  if (p.hidden) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    o.color = float4(0.0);
    return o;
  }
  RowRectUniforms r;
  r.bpRangeX       = u.bpRangeX;
  r.canvasHeight   = u.canvasHeight;
  r.minCellDenomPx = u.minCellDenomPx;
  r.minCellPx      = u.minCellPx;
  r.zero           = u.zero;
  r.rowHeight      = u.rowHeight;
  r.rowProportion  = u.rowProportion;
  r.scrollTop      = u.scrollTop;
  o.position = rowRectClipPos(inst.x, inst.x2, float(p.slot), vid, r);
  o.color = p.color;
  return o;
}

[shader("fragment")]
float4 fs_main(RowRectVsOut v) : SV_Target {
  return v.color;
}

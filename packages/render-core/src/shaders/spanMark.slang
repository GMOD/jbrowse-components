// The `span` mark shape: one instance is a colored rectangle spanning
// [x, x2) in absolute genomic coords, on the row band given by the `row`
// channel. The geometry — row band, hp clip-x span, min-width widening — is
// `rowRect`'s; this is the entry point that makes it a pass a mark can draw.
//
// `row` is read through the bound row table (`rowTable`): a key resolved to
// its drawn slot and color, or collapsed to a zero-area quad off clip space
// where the table hides it. A pass binding no table (`rowTableKeys` −1) draws
// `row` as the slot, which is what every consumer did before the table.
//
// The color slot is `markColor`'s: a packed ABGR, or under a ramp or a
// threshold the value's bits resolved here through the uniforms, which is
// what makes a span colored by a field a heatmap whose domain moves as a
// uniform.
//! targets: wgsl, glsl
//! instance-writer

import colorPack;
import markColor;
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
  // `markColor`'s: 0 packs the instance's color, 1 and 2 read its slot as a
  // value through the ramp, 3 through the threshold below.
  int    rampMode;
  float  rampMin;
  float  rampMax;
  float  rampMidNorm;
  int    colorCutCount;
  float4 colorCuts[2];
  float4 colorBands[MAX_COLOR_BANDS];
};

[[vk::binding(1, 0)]] ConstantBuffer<SpanMarkUniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;
[[vk::binding(4, 0)]] Sampler2D<float4> rowTable;

[shader("vertex")]
RowRectVsOut vs_main(RowRectInstance inst, uint vid : SV_VertexID) {
  RowPlacement p = rowTableLookup(rowTable, inst.row, u.rowTableKeys,
    markScaleColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax, u.rampMidNorm, u.colorCutCount, u.colorCuts[0], u.colorCuts[1], u.colorBands));
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

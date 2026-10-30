// The `span` mark shape: one instance is a colored rectangle spanning
// [x, x2) in absolute genomic coords, on the row band given by the `row`
// channel. The row band and min-width widening are `rowRect`'s; the band's
// edges snap to the device grid (`rowSnap`), as the Canvas2D painter's do, so
// stacked rows meet on a pixel boundary at any sample count.
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
import hpmath;
import markColor;
import rowRect;
import rowSnap;
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
  // The backing store's y scale (`clip.scaleY`), which rows snap to.
  float  devicePixelRatio;
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
  float2 q = quadLocal(vid);
  float sx1 = hpToClipX(hpSplitUint(inst.x), u.bpRangeX, u.zero);
  float sx2 = hpToClipX(hpSplitUint(inst.x2), u.bpRangeX, u.zero);
  sx2 = extendToMinWidthX(sx1, sx2, u.minCellPx, u.minCellDenomPx);

  RowBand band = rowBandPx(u.rowHeight, u.rowProportion);
  float slot = float(p.slot);
  float offsetRows = band.offset / u.rowHeight;
  float top = snappedRowTopPx(slot + offsetRows, u.rowHeight, u.scrollTop, u.devicePixelRatio);
  float bottom = snappedRowBottomPx(slot + offsetRows, u.rowHeight, band.height, u.scrollTop, u.devicePixelRatio);

  o.position = float4(lerp(sx1, sx2, q.x),
                      yPxToClipY(lerp(top, bottom, q.y), u.canvasHeight), 0.0, 1.0);
  o.color = p.color;
  return o;
}

[shader("fragment")]
float4 fs_main(RowRectVsOut v) : SV_Target {
  return v.color;
}

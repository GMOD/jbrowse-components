// The `insertion` mark shape: one instance is an insertion marker centred on
// the midpoint of [x, x2] (x2 = x for an interbase insertion), on the row band
// of `row`, sized by `length` through `insertionGlyph`, in `color`. Up to three
// quads: the bar, then the top and bottom serif caps.
//
// A marker standing on a reference span draws only where it outgrows that
// span (`insertionMarkerDraws`). `row` is read through the bound row table
// for its slot and visibility; the bar keeps its own color, since an
// insertion's color is not the row's.
//! targets: wgsl, glsl
//! blend: premultiplied
//! instance-writer
//! export-consts: MIN_OUTLINED_PX, OUTLINE_ALPHA

import colorPack;
import hpmath;
import insertionGlyph;
import rowTable;

public static const uint VERTS_PER_INSTANCE = 18u;

static const float MIN_OUTLINED_PX = 5.0;
static const float OUTLINE_ALPHA = 0.6;

struct InsertionInstance {
  uint x      : ATTR0;
  uint x2     : ATTR1;
  uint row    : ATTR2;
  uint length : ATTR3;
  uint color  : ATTR4;
};

struct InsertionMarkUniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  viewportWidth;
  float  zero;
  float  pxPerBp;
  float  rowHeight;
  float  rowOffsetPx;
  float  bandHeightPx;
  float  spanFloorPx;
  int    outline;
  int    rowTableKeys;
};

[[vk::binding(1, 0)]] ConstantBuffer<InsertionMarkUniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> rowTable;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPx  : COLOR1;
  nointerpolation float2 sizePx  : COLOR2;
  nointerpolation uint   outline : COLOR3;
};

float viewportPx(uint bp, float pxSize, float halfW) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero) / pxSize + halfW;
}

VsOut culled() {
  VsOut o;
  o.position = float4(2.0, 2.0, 0.0, 1.0);
  o.color = float4(0.0);
  o.localPx = float2(0.0);
  o.sizePx = float2(0.0);
  o.outline = 0u;
  return o;
}

[shader("vertex")]
VsOut vs_main(InsertionInstance inst, uint vid : SV_VertexID) {
  RowPlacement p = rowTableLookup(rowTable, inst.row, u.rowTableKeys, float4(0.0));
  uint rectIdx = vid / 6u;
  float pxSize = pxToClipLen(1.0, u.viewportWidth);
  float halfW = u.viewportWidth * 0.5;
  float x1 = viewportPx(inst.x, pxSize, halfW);
  float x2 = viewportPx(inst.x2, pxSize, halfW);
  float h = u.bandHeightPx;
  float barW = insertionBarWidthPx(inst.length, u.pxPerBp, h);
  if (p.hidden
      || !insertionMarkerDraws(barW, x2 - x1, u.spanFloorPx)
      || (rectIdx != 0u && !insertionSerifsDraw(inst.length, u.pxPerBp))) {
    return culled();
  }
  float cx = 0.5 * (x1 + x2);
  float top = rowBandTopPx(u.rowOffsetPx, u.rowHeight, p.slot);
  float2 q = quadLocal(vid);

  float xPx;
  float yPx;
  if (rectIdx == 0u) {
    xPx = cx + barW * (q.x - 0.5);
    yPx = top + h * (1.0 - q.y);
  } else {
    float baseY = rectIdx == 1u ? top : top + h;
    float apexY = rectIdx == 1u ? top + SERIF_H_PX : top + h - SERIF_H_PX;
    xPx = cx + SERIF_HALF_W_PX * (2.0 * q.x - 1.0) * (1.0 - q.y);
    yPx = lerp(baseY, apexY, q.y);
  }

  VsOut o;
  o.position = float4((xPx - halfW) * pxSize, yPxToClipY(yPx, u.canvasHeight), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.localPx = float2(barW * q.x, h * (1.0 - q.y));
  o.sizePx = float2(barW, h);
  o.outline = rectIdx == 0u && u.outline != 0
      && barW >= MIN_OUTLINED_PX && h >= MIN_OUTLINED_PX ? 1u : 0u;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float4 fill = float4(fragIn.color.rgb * fragIn.color.a, fragIn.color.a);
  if (fragIn.outline != 0u) {
    float2 p = fragIn.localPx;
    float2 s = fragIn.sizePx;
    if (p.x < 1.0 || p.y < 1.0 || p.x > s.x - 1.0 || p.y > s.y - 1.0) {
      return fill * (1.0 - OUTLINE_ALPHA) + float4(0.0, 0.0, 0.0, OUTLINE_ALPHA);
    }
  }
  return fill;
}

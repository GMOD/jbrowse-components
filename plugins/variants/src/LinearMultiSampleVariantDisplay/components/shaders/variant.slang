// Multi-variant display — one instance per variant cell. Emits a
// bounding-box quad; the fragment shader uses SDFs to carve out
// triangle/inversion glyphs from the quad when shapeType != RECT.
//! targets: wgsl, glsl

import hpmath;
import colorPack;


public static const uint VERTS_PER_INSTANCE = 6u;

// Insertion glyph triangle↔dot fade. These MIRROR `insertionGlyph` in
// ../variantShape.ts (the canonical definition) — edit both together. span ≤
// INS_DOT_SPAN_PX px collapses to a small square dot; ≥ INS_TRI_SPAN_PX px is a
// full triangle whose base width caps at INS_TRI_SPAN_PX; INS_DOT_SIZE_PX is the
// collapsed dot side length / min width.
static const float INS_DOT_SPAN_PX = 2.0;
static const float INS_TRI_SPAN_PX = 10.0;
static const float INS_DOT_SIZE_PX = 6.0;

struct CellInstance {
  uint2 startEnd  : ATTR0;
  uint  rowIndex  : ATTR1;
  uint  shapeType : ATTR2;
  uint  color     : ATTR3;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  canvasWidth;
  float  rowHeight;
  float  scrollTop;
  float  zero;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPx  : COLOR1;
  nointerpolation float2 sizePx    : COLOR2;
  nointerpolation uint   shapeType : COLOR3;
  // Precomputed hypotenuse terms for SDF functions — avoids per-fragment sqrt.
  // hypRight = sqrt(h*h*0.25 + w*w), hypDown = sqrt(h*h + w*w*0.25)
  nointerpolation float  hypRight  : COLOR4;
  nointerpolation float  hypDown   : COLOR5;
  // Insertion morph: 0 = collapsed line, 1 = full down-triangle.
  nointerpolation float  triBlend  : COLOR6;
};

[shader("vertex")]
VsOut vs_main(CellInstance inst, uint vid : SV_VertexID) {
  float clipX1 = bpToClipX(inst.startEnd.x, u);
  float clipX2 = bpToClipX(inst.startEnd.y, u);
  // Reversal is baked into bpRangeX (negated length), so clipX2 < clipX1 on
  // reversed regions. Order the edges to screen-space left/right before snapping
  // so a wide variant spans its full extent instead of collapsing to the
  // min-width sliver on the wrong side — mirrors the Math.min/Math.abs in
  // Canvas2DVariantRenderer.ts.
  float loClip = min(clipX1, clipX2);
  float hiClip = max(clipX1, clipX2);

  float pxSize = 2.0 / u.canvasWidth;
  float cx1 = floor(loClip / pxSize + 0.5) * pxSize;
  float cx2 = max(floor(hiClip / pxSize + 0.5) * pxSize, cx1 + 2.0 * pxSize);

  // fractional y keeps subpixel rows smooth (no rounding = no discrete jumps
  // during resize); max(...,2) is the minimum quad height so a lone cell in a
  // sparse matrix stays visible (matches the 2px min width) rather than fading
  // to a sub-pixel sliver, while preserving draw order for variant priority.
  // 2px-min mirrored in Canvas2DVariantRenderer.ts (draw) +
  // variantHitTest.ts (hit-test) — keep in sync.
  float yTop = float(inst.rowIndex) * u.rowHeight - u.scrollTop;
  float yBot = yTop + max(u.rowHeight, 2.0);
  float pxToClipY = 2.0 / u.canvasHeight;
  float cyTop = 1.0 - yTop * pxToClipY;
  float cyBot = 1.0 - yBot * pxToClipY;

  float2 q = quadLocal(vid);
  float lx = q.x, ly = q.y;

  // Insertion glyph (shapeType 3): morph a down-triangle into a small centered
  // dot as its alt-allele span narrows on screen. Mirrors insertionGlyph() in
  // ../variantShape.ts — the quad here carries the morphed top width (wide
  // enough for the dot when collapsed); the fragment shader blends the
  // triangle/circle SDFs by triBlend.
  float xLeft = cx1;
  float xRight = cx2;
  float triBlend = 1.0;
  if (inst.shapeType == 3u) {
    float spanPx = (hiClip - loClip) * u.canvasWidth * 0.5;
    triBlend = smoothstep(INS_DOT_SPAN_PX, INS_TRI_SPAN_PX, spanPx);
    float cappedSpan = min(spanPx, INS_TRI_SPAN_PX);
    float topWidthPx = lerp(INS_DOT_SIZE_PX, max(cappedSpan, INS_DOT_SIZE_PX), triBlend);
    float halfClip = topWidthPx / u.canvasWidth;
    float center = (cx1 + cx2) * 0.5;
    xLeft = center - halfClip;
    xRight = center + halfClip;
  }

  float wPx = (xRight - xLeft) * u.canvasWidth * 0.5;
  float hPx = max(u.rowHeight, 2.0);

  VsOut o;
  o.position = float4(lerp(xLeft, xRight, lx), lerp(cyBot, cyTop, ly), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.localPx = float2(lx * wPx, (1.0 - ly) * hPx);
  o.sizePx = float2(wPx, hPx);
  o.shapeType = inst.shapeType;
  o.triBlend = triBlend;
  o.hypRight = sqrt(hPx * hPx * 0.25 + wPx * wPx);
  o.hypDown  = sqrt(hPx * hPx + wPx * wPx * 0.25);
  return o;
}

float triSdfRight(float2 p, float w, float h, float hyp) {
  float dLeft = p.x;
  float dTop = (-0.5 * h * p.x + w * p.y) / hyp;
  float dBot = (-0.5 * h * p.x - w * (p.y - h)) / hyp;
  return min(min(dLeft, dTop), dBot);
}

float triSdfDown(float2 p, float w, float h, float hyp) {
  float dTop = p.y;
  float dLeft = (h * p.x - 0.5 * w * p.y) / hyp;
  float dRight = (w * h - h * p.x - 0.5 * w * p.y) / hyp;
  return min(min(dTop, dLeft), dRight);
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float alpha = fragIn.color.a;

  if (fragIn.shapeType != 0u) {
    float d;
    float w = fragIn.sizePx.x;
    float h = fragIn.sizePx.y;

    if (fragIn.shapeType == 1u) {
      d = triSdfRight(fragIn.localPx, w, h, fragIn.hypRight);
    } else if (fragIn.shapeType == 2u) {
      d = triSdfRight(float2(w - fragIn.localPx.x, fragIn.localPx.y), w, h, fragIn.hypRight);
    } else {
      // Insertion: blend the down-triangle SDF toward a small centered-square
      // (dot) SDF as triBlend → 0. Matches the triangle/square drawn by
      // insertionGlyph() on the Canvas2D/SVG path.
      float dTri = triSdfDown(fragIn.localPx, w, h, fragIn.hypDown);
      float2 dq = abs(fragIn.localPx - float2(w * 0.5, h * 0.5));
      float dDot = min(w, h) * 0.5 - max(dq.x, dq.y);
      d = lerp(dDot, dTri, fragIn.triBlend);
    }

    alpha *= smoothstep(-0.5, 0.5, d);
    // The collapsed insertion dot fits within the row height; gate its min-size
    // fade on height alone so it stays opaque rather than fading on width.
    float minSide = fragIn.shapeType == 3u ? h : min(w, h);
    alpha *= smoothstep(0.0, 3.0, minSide);
  }

  return float4(fragIn.color.rgb * alpha, alpha);
}

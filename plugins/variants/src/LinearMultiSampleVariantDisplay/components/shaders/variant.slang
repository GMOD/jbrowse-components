// Multi-variant display — one instance per variant cell. Emits a
// bounding-box quad; the fragment shader uses an SDF to carve the inversion
// triangle glyph out of the quad when shapeType != RECT.
//! targets: wgsl, glsl

import hpmath;
import colorPack;


public static const uint VERTS_PER_INSTANCE = 6u;

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
  // Precomputed hypotenuse term for the tapered-tip SDF — avoids a per-fragment
  // sqrt. hypRight = sqrt(h*h*0.25 + t*t), over the taper length t rather than
  // the whole cell width.
  nointerpolation float  hypRight  : COLOR4;
  // Taper length in px (see variantTaperPx in ../variantShape.ts).
  nointerpolation float  taperPx   : COLOR5;
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

  // Pixel-snap + 2px floor. Mirrored on the CPU by snapVariantCellX.ts, which
  // the Canvas2D backend and the SVG export both call — snapping here only
  // would put exports half a pixel off the on-screen render at sub-pixel scale.
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
  float cyTop = yPxToClipY(yTop, u.canvasHeight);
  float cyBot = yPxToClipY(yBot, u.canvasHeight);

  float2 q = quadLocal(vid);
  float lx = q.x, ly = q.y;

  float wPx = (cx2 - cx1) * u.canvasWidth * 0.5;
  float hPx = max(u.rowHeight, 2.0);

  VsOut o;
  o.position = float4(lerp(cx1, cx2, lx), lerp(cyBot, cyTop, ly), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.localPx = float2(lx * wPx, (1.0 - ly) * hPx);
  o.sizePx = float2(wPx, hPx);
  o.shapeType = inst.shapeType;
  float tPx = min(wPx, hPx);
  o.taperPx = tPx;
  o.hypRight = sqrt(hPx * hPx * 0.25 + tPx * tPx);
  return o;
}

// Signed distance to a cell with a pointed right end (the caller mirrors x, so
// the point lands on screen-left). The tip occupies the last `t` px: half-height
// runs at h/2 until x = w - t, then falls linearly to 0 at x = w. With t == w
// this is the plain triangle it generalizes; it is the intersection of five half
// planes, so the distance is the min of theirs.
float tipSdfRight(float2 p, float w, float h, float t, float hyp) {
  float xt = p.x - (w - t);
  float dLeft = p.x;
  float dTop = (-0.5 * h * xt + t * p.y) / hyp;
  float dBot = (-0.5 * h * xt - t * (p.y - h)) / hyp;
  return min(min(min(dLeft, p.y), h - p.y), min(dTop, dBot));
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float alpha = fragIn.color.a;

  // Any non-rect cell is an inversion, drawn with a left-pointing tip via a
  // mirrored SDF (SHAPE_TRI_LEFT in ../variantShape.ts).
  if (fragIn.shapeType != 0u) {
    float w = fragIn.sizePx.x;
    float h = fragIn.sizePx.y;
    float d = tipSdfRight(float2(w - fragIn.localPx.x, fragIn.localPx.y), w, h, fragIn.taperPx, fragIn.hypRight);
    alpha *= smoothstep(-0.5, 0.5, d);
    // Fade a glyph too small to carve a readable tip out of. Keyed on width
    // alone: with the taper capped at the cell height, a wide short cell is
    // mostly rect and has no more aliasing than the plain rect beside it, so
    // `min(w, h)` here dimmed every genotype in a 22 Mb <INV> lane to 74% for
    // the sake of a tip 2px long.
    alpha *= smoothstep(0.0, 3.0, w);
  }

  return float4(fragIn.color.rgb * alpha, alpha);
}

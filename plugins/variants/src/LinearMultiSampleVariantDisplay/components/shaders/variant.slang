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
  // Precomputed hypotenuse term for the triangle SDF — avoids a per-fragment
  // sqrt. hypRight = sqrt(h*h*0.25 + w*w).
  nointerpolation float  hypRight  : COLOR4;
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
  o.hypRight = sqrt(hPx * hPx * 0.25 + wPx * wPx);
  return o;
}

float triSdfRight(float2 p, float w, float h, float hyp) {
  float dLeft = p.x;
  float dTop = (-0.5 * h * p.x + w * p.y) / hyp;
  float dBot = (-0.5 * h * p.x - w * (p.y - h)) / hyp;
  return min(min(dLeft, dTop), dBot);
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float alpha = fragIn.color.a;

  // Any non-rect cell is an inversion, drawn as a left-pointing triangle via a
  // mirrored right-triangle SDF (SHAPE_TRI_LEFT in ../variantShape.ts).
  if (fragIn.shapeType != 0u) {
    float w = fragIn.sizePx.x;
    float h = fragIn.sizePx.y;
    float d = triSdfRight(float2(w - fragIn.localPx.x, fragIn.localPx.y), w, h, fragIn.hypRight);
    alpha *= smoothstep(-0.5, 0.5, d);
    alpha *= smoothstep(0.0, 3.0, min(w, h));
  }

  return float4(fragIn.color.rgb * alpha, alpha);
}

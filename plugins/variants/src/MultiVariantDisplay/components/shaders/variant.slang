// Multi-variant display — one instance per variant cell. Emits a
// bounding-box quad; the fragment shader uses SDFs to carve out
// triangle/inversion glyphs from the quad when shapeType != RECT.
//! targets: wgsl, glsl

import hpmath;

float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}

struct CellInstance {
  uint2 startEnd  : ATTR0;
  uint  rowIndex  : ATTR1;
  uint  shapeType : ATTR2;
  uint  color     : ATTR3;
};

struct Uniforms {
  float3 bpRangeX;
  uint   regionStart;
  float  canvasHeight;
  float  canvasWidth;
  float  rowHeight;
  float  scrollTop;
  float  zero;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPx  : COLOR1;
  nointerpolation float2 sizePx    : COLOR2;
  nointerpolation uint   shapeType : COLOR3;
};

[shader("vertex")]
VsOut vs_main(CellInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  uint absStart = inst.startEnd.x + u.regionStart;
  uint absEnd   = inst.startEnd.y + u.regionStart;
  float clipX1 = hpToClipX(hpSplitUint(absStart), u.bpRangeX, u.zero);
  float clipX2 = hpToClipX(hpSplitUint(absEnd),   u.bpRangeX, u.zero);

  float pxSize = 2.0 / u.canvasWidth;
  float cx1 = floor(clipX1 / pxSize + 0.5) * pxSize;
  float cx2 = max(floor(clipX2 / pxSize + 0.5) * pxSize, cx1 + 2.0 * pxSize);

  // fractional y keeps subpixel rows smooth (no rounding = no discrete jumps
  // during resize); max(...,1) is the minimum quad height to avoid GPU-culled
  // zero-height geometry while preserving draw order for variant priority
  float yTop = float(inst.rowIndex) * u.rowHeight - u.scrollTop;
  float yBot = yTop + max(u.rowHeight, 1.0);
  float pxToClipY = 2.0 / u.canvasHeight;
  float cyTop = 1.0 - yTop * pxToClipY;
  float cyBot = 1.0 - yBot * pxToClipY;

  float lx = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float ly = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;

  float naturalWPx = (cx2 - cx1) * u.canvasWidth * 0.5;
  uint effectiveShape = inst.shapeType;
  if (inst.shapeType == 3u && naturalWPx < 1.0) {
    effectiveShape = 0u;
  }

  float xLeft = cx1;
  float xRight = cx2;
  if (effectiveShape == 3u) {
    float widthExtend = 6.0 / u.canvasWidth;
    xLeft -= widthExtend;
    xRight += widthExtend;
  }

  float wPx = (xRight - xLeft) * u.canvasWidth * 0.5;
  float hPx = max(u.rowHeight, 1.0);

  VsOut o;
  o.position = float4(lerp(xLeft, xRight, lx), lerp(cyBot, cyTop, ly), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.localPx = float2(lx * wPx, (1.0 - ly) * hPx);
  o.sizePx = float2(wPx, hPx);
  o.shapeType = effectiveShape;
  return o;
}

float triSdfRight(float2 p, float w, float h) {
  float dLeft = p.x;
  float hyp = sqrt(h * h * 0.25 + w * w);
  float dTop = (-0.5 * h * p.x + w * p.y) / hyp;
  float dBot = (-0.5 * h * p.x - w * (p.y - h)) / hyp;
  return min(min(dLeft, dTop), dBot);
}

float triSdfDown(float2 p, float w, float h) {
  float dTop = p.y;
  float hyp = sqrt(h * h + w * w * 0.25);
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
      d = triSdfRight(fragIn.localPx, w, h);
    } else if (fragIn.shapeType == 2u) {
      d = triSdfRight(float2(w - fragIn.localPx.x, fragIn.localPx.y), w, h);
    } else {
      d = triSdfDown(fragIn.localPx, w, h);
    }

    alpha *= smoothstep(-0.5, 0.5, d);
    alpha *= smoothstep(0.0, 3.0, min(w, h));
  }

  return float4(fragIn.color.rgb * alpha, alpha);
}

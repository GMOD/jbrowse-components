// Wiggle track renderer. One shader covers four rendering modes (xyplot,
// density, line, scatter) branched on the `renderingType` uniform, plus
// linear/log scale branch. Same shader is bound to two passes via different
// primitive topologies: PASS_FILL uses triangle-list, PASS_LINE uses
// line-list — both read the same per-instance vertex buffer.
//! targets: wgsl, glsl

import hpmath;

static const int RENDERING_TYPE_XYPLOT = 0;
static const int RENDERING_TYPE_DENSITY = 1;
static const int RENDERING_TYPE_LINE = 2;
static const int RENDERING_TYPE_SCATTER = 3;
static const int SCALE_TYPE_LOG = 1;

// RGBA32 packed into a single u32 (R=byte0 … A=byte3, little-endian).
// Matches cssColorToABGR on the CPU side.
float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}

struct WiggleInstance {
  uint2 startEnd  : ATTR0;
  float score     : ATTR1;
  float prevScore : ATTR2;
  uint  color     : ATTR3;
  float rowIndex  : ATTR4;
};

struct Uniforms {
  float3 bpRangeX;
  uint   regionStart;
  float  canvasHeight;
  int    scaleType;
  int    renderingType;
  float  numRows;
  float  domainYMin;
  float  domainYMax;
  float  zero;
  float  viewportWidth;
  float  reversed;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float normalizeScore(float score, float domainMin, float domainMax, int scaleType) {
  if (scaleType == SCALE_TYPE_LOG) {
    float logMin = log2(max(domainMin, 1.0));
    float logMax = log2(max(domainMax, 1.0));
    float logScore = log2(max(score, 1.0));
    return clamp((logScore - logMin) / (logMax - logMin), 0.0, 1.0);
  }
  return clamp((score - domainMin) / (domainMax - domainMin), 0.0, 1.0);
}

float scoreToY(float score, float domainMin, float domainMax, float h, int scaleType) {
  return (1.0 - normalizeScore(score, domainMin, domainMax, scaleType)) * h;
}

// Quad vertex layout shared by density, scatter and xyplot branches. The six
// vertices of a triangle-list quad produce local [0,1]×[0,1] corners.
float2 quadLocal(uint v) {
  float localX = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float localY = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;
  return float2(localX, localY);
}

[shader("vertex")]
VsOut vs_main(WiggleInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  uint absStart = inst.startEnd.x + u.regionStart;
  uint absEnd   = inst.startEnd.y + u.regionStart;
  float sx1 = hpToClipX(hpSplitUint(absStart), u.bpRangeX, u.zero);
  float sx2 = hpToClipX(hpSplitUint(absEnd),   u.bpRangeX, u.zero);
  float minClipW = 3.0 / u.viewportWidth;
  if (sx2 - sx1 < minClipW) {
    sx2 = sx1 + minClipW;
  }

  float rowHeight = u.canvasHeight / u.numRows;
  float rowTop = inst.rowIndex * rowHeight;
  float pxToClip = 2.0 / u.canvasHeight;

  float sx;
  float sy;

  if (u.renderingType == RENDERING_TYPE_LINE) {
    float scoreY = scoreToY(inst.score,     u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop;
    float prevY  = scoreToY(inst.prevScore, u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop;
    float clipScoreY = 1.0 - scoreY * pxToClip;
    float clipPrevY  = 1.0 - prevY  * pxToClip;
    if (v == 0u) {
      sx = sx1;
      sy = clipPrevY;
    } else if (v < 3u) {
      sx = sx1;
      sy = clipScoreY;
    } else {
      sx = sx2;
      sy = clipScoreY;
    }
  } else {
    float2 q = quadLocal(v);
    sx = lerp(sx1, sx2, q.x);
    if (u.renderingType == RENDERING_TYPE_DENSITY) {
      float syTop = 1.0 - rowTop * pxToClip;
      float syBot = 1.0 - (rowTop + rowHeight) * pxToClip;
      sy = lerp(syBot, syTop, q.y);
    } else if (u.renderingType == RENDERING_TYPE_SCATTER) {
      float scoreY = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop;
      float syTop = 1.0 - (scoreY - 1.0) * pxToClip;
      float syBot = 1.0 - (scoreY + 1.0) * pxToClip;
      sy = lerp(syBot, syTop, q.y);
    } else {
      float scoreY  = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType);
      float originY = scoreToY(0.0,        u.domainYMin, u.domainYMax, rowHeight, u.scaleType);
      float yTop = min(scoreY, originY) + rowTop;
      float yBot = max(scoreY, originY) + rowTop;
      float syTop = 1.0 - yTop * pxToClip;
      float syBot = 1.0 - yBot * pxToClip;
      sy = lerp(syBot, syTop, q.y);
    }
  }

  float4 instColor = unpackRGBA(inst.color);
  float4 outColor;
  if (u.renderingType == RENDERING_TYPE_DENSITY) {
    float norm = normalizeScore(inst.score, u.domainYMin, u.domainYMax, u.scaleType);
    float zeroNorm = normalizeScore(0.0,    u.domainYMin, u.domainYMax, u.scaleType);
    float maxDist = max(zeroNorm, 1.0 - zeroNorm);
    float t = abs(norm - zeroNorm) / max(maxDist, 0.0001);
    outColor = float4(lerp(float3(1.0), instColor.rgb, t), 1.0);
  } else {
    outColor = float4(instColor.rgb, 1.0);
  }

  float flippedX = lerp(sx, -sx, u.reversed);

  VsOut o;
  o.position = float4(flippedX, sy, 0.0, 1.0);
  o.color = outColor;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

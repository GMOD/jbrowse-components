// Wiggle track renderer. One shader covers four rendering modes (xyplot,
// density, line, scatter) branched on the `renderingType` uniform, plus
// linear/log scale branch. Same shader is bound to two passes via different
// primitive topologies: PASS_FILL uses triangle-list, PASS_LINE uses
// line-list — both read the same per-instance vertex buffer.
//! targets: wgsl, glsl

import hpmath;
import colorPack;


public static const uint VERTS_PER_INSTANCE = 6u;
static const int RENDERING_TYPE_XYPLOT = 0;
static const int RENDERING_TYPE_DENSITY = 1;
static const int RENDERING_TYPE_LINE = 2;
static const int RENDERING_TYPE_SCATTER = 3;
static const int SCALE_TYPE_LOG = 1;

struct WiggleInstance {
  uint2 startEnd  : ATTR0;
  float score     : ATTR1;
  float prevScore : ATTR2;
  float nextScore : ATTR3;
  uint  color     : ATTR4;
  float rowIndex  : ATTR5;
};

struct Uniforms {
  float3 bpRangeX;
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

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float normalizeScore(float score, float domainMin, float domainMax, int scaleType) {
  // `max(range, 1e-6)` guards a degenerate (min==max) domain from dividing by
  // zero — the JS makeScoreNormalizer returns 0 in that case; here we just
  // avoid NaN propagating into the vertex position.
  if (scaleType == SCALE_TYPE_LOG) {
    float logMin = log2(max(domainMin, 1.0));
    float logMax = log2(max(domainMax, 1.0));
    float logScore = log2(max(score, 1.0));
    return clamp((logScore - logMin) / max(logMax - logMin, 1e-6), 0.0, 1.0);
  }
  return clamp((score - domainMin) / max(domainMax - domainMin, 1e-6), 0.0, 1.0);
}

float scoreToY(float score, float domainMin, float domainMax, float h, int scaleType) {
  return (1.0 - normalizeScore(score, domainMin, domainMax, scaleType)) * h;
}

// Score → clip-space Y within a single row (line mode). Reads the y domain and
// scale type from the global uniforms.
float rowScoreToClipY(float score, float rowTop, float rowHeight, float pxToClip) {
  float yPx = scoreToY(score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop;
  return 1.0 - yPx * pxToClip;
}


[shader("vertex")]
VsOut vs_main(WiggleInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.startEnd.x, u);
  float sx2 = bpToClipX(inst.startEnd.y, u);

  float rowHeight = u.canvasHeight / u.numRows;
  float rowTop = inst.rowIndex * rowHeight;
  float pxToClip = 2.0 / u.canvasHeight;

  float sx;
  float sy;

  if (u.renderingType == RENDERING_TYPE_LINE) {
    uint v = vid % VERTS_PER_INSTANCE;
    float clipScoreY = rowScoreToClipY(inst.score,     rowTop, rowHeight, pxToClip);
    float clipPrevY  = rowScoreToClipY(inst.prevScore, rowTop, rowHeight, pxToClip);
    float clipNextY  = rowScoreToClipY(inst.nextScore, rowTop, rowHeight, pxToClip);
    // line-list segments: (v0,v1)=vertical-at-start, (v2,v3)=horizontal, (v4,v5)=vertical-at-end
    // prevScore=0 encodes gapBefore (rise from zero); nextScore=0 encodes gapAfter (drop to zero)
    // No min-width floor here: the line is a continuous polyline, so widening a
    // single instance's end would break the join with the next feature's start.
    if (v == 0u) {
      sx = sx1;
      sy = clipPrevY;
    } else if (v < 3u) {
      sx = sx1;
      sy = clipScoreY;
    } else if (v < 5u) {
      sx = sx2;
      sy = clipScoreY;
    } else {
      sx = sx2;
      sy = clipNextY;
    }
  } else {
    // 3px (1.5 CSS px) minimum width keeps sub-pixel features visible, matching
    // WIGGLE_MIN_PX in the Canvas2D path.
    float minClipW = 3.0 / u.viewportWidth;
    if (sx2 - sx1 < minClipW) {
      sx2 = sx1 + minClipW;
    }
    float2 q = quadLocal(vid);
    sx = lerp(sx1, sx2, q.x);

    // Each fill mode picks a vertical [topPx, botPx] span; the clip-space
    // conversion and y-lerp are shared.
    float topPx;
    float botPx;
    if (u.renderingType == RENDERING_TYPE_DENSITY) {
      topPx = rowTop;
      botPx = rowTop + rowHeight;
    } else if (u.renderingType == RENDERING_TYPE_SCATTER) {
      float scoreY = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop;
      topPx = scoreY - 1.0;
      botPx = scoreY + 1.0;
    } else {
      float scoreY  = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType);
      float originY = scoreToY(0.0,        u.domainYMin, u.domainYMax, rowHeight, u.scaleType);
      topPx = min(scoreY, originY) + rowTop;
      botPx = max(scoreY, originY) + rowTop;
    }
    sy = lerp(1.0 - botPx * pxToClip, 1.0 - topPx * pxToClip, q.y);
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

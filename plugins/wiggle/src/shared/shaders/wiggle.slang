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

// Scatter glyph shapes carved by the fragment shader (matches manhattan.slang):
// point-like features become an AA disc, wide (low-zoom) bins a solid bar.
static const float SHAPE_SOLID = 0.0;
static const float SHAPE_DISC = 1.0;
static const float SHAPE_BAR = 2.0;
// 1px device pad around a disc so the smoothstep edge has room to fade.
static const float AA_PAD_PX = 1.0;
// At/below this diameter an AA disc reads as a muddy blob, so draw a crisp
// filled square instead (must match SMALL_POINT_MAX_DIAMETER_PX in JS).
static const float SMALL_POINT_MAX_DIAMETER = 3.0;

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
  float  scatterPointSize;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // scatter-only: local quad coord (-1..1) for disc AA, and the shape selector.
  // SHAPE_SOLID for every non-scatter mode so the fragment shader returns a flat
  // fill.
  float2 localPos : TEXCOORD0;
  float  shape    : TEXCOORD1;
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
  float shape = SHAPE_SOLID;
  float2 localPos = float2(0.0, 0.0);

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
  } else if (u.renderingType == RENDERING_TYPE_SCATTER) {
    // Point plot: an AA disc centered on the bp midpoint (matches
    // manhattan.slang). scatterPointSize is the disc diameter. A bin wider than
    // the point becomes a horizontal bar so low-zoom summary bins keep their
    // extent instead of collapsing to a dot.
    float midX = (sx1 + sx2) * 0.5;
    float scoreYPx = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop;
    float centerClipY = 1.0 - scoreYPx * pxToClip;
    float2 q = quadLocal(vid);
    float2 local = q * 2.0 - float2(1.0, 1.0);
    float radiusPx = u.scatterPointSize * 0.5;
    float spanPx = abs(sx2 - sx1) * 0.5 * u.viewportWidth;
    if (spanPx > u.scatterPointSize) {
      float padClipX = AA_PAD_PX * 2.0 / u.viewportWidth;
      sx = (q.x < 0.5 ? min(sx1, sx2) - padClipX : max(sx1, sx2) + padClipX);
      sy = centerClipY + local.y * radiusPx * pxToClip;
      shape = SHAPE_BAR;
      localPos = local;
    } else if (u.scatterPointSize <= SMALL_POINT_MAX_DIAMETER) {
      // tiny point: crisp filled square (SHAPE_SOLID), no AA disc
      sx = midX + local.x * radiusPx * 2.0 / u.viewportWidth;
      sy = centerClipY + local.y * radiusPx * pxToClip;
      shape = SHAPE_SOLID;
    } else {
      // expand the quad by the AA pad so the disc's fade edge isn't clipped
      float expand = (radiusPx + AA_PAD_PX) / max(radiusPx, 0.5);
      float halfPx = radiusPx * expand;
      sx = midX + local.x * halfPx * 2.0 / u.viewportWidth;
      sy = centerClipY + local.y * halfPx * pxToClip;
      shape = SHAPE_DISC;
      localPos = local * expand;
    }
  } else {
    // 3px (1.5 CSS px) minimum width keeps sub-pixel features visible, matching
    // WIGGLE_MIN_PX in the Canvas2D path. Reversal is baked into bpRangeX
    // (negated length), so sx2 < sx1 for reversed blocks — extend in the sign
    // direction of dx to preserve orientation (see rect.slang).
    float minClipW = 3.0 / u.viewportWidth;
    float dx = sx2 - sx1;
    if (abs(dx) < minClipW) {
      sx2 = sx1 + (dx < 0.0 ? -minClipW : minClipW);
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

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = outColor;
  o.localPos = localPos;
  o.shape = shape;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Solid modes (xyplot/density/line) and the wide-bin bar are flat fills.
  if (fragIn.shape != SHAPE_DISC) {
    return fragIn.color;
  }
  // Disc: boundary at distance 1 from center, SDF = 1 - radius, smoothstep AA.
  float coverage = 1.0 - length(fragIn.localPos);
  float aa = fwidth(coverage);
  float alpha = smoothstep(-aa, aa, coverage);
  if (alpha <= 0.0) {
    discard;
  }
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

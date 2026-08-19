// The wiggle renderer's three FILLED renderings — xyplot, density and scatter —
// branched on the `renderingType` uniform, plus a linear/log scale branch. Its
// sibling `wiggleLine.slang` draws the stroked ones (line, linecenter); both
// import `wiggleCommon` for the uniform block and the score math. Bound to
// PASS_FILL, which draws 6-vert quads.
//
// None of these three reads a neighbouring feature, which is why the instance
// record below is the five words it is: a module reflects one instance struct,
// so while all five renderings shared this shader every fill buffer also carried
// the step-line's prevScore/nextScore and the center-line's
// prevStartEnd/prevScoreLine — 20 bytes per feature that no fill pass reads,
// and tens of MB of a 1000-source multiwiggle's single per-region allocation.
//! targets: wgsl, glsl

import hpmath;
import colorPack;
import pointGlyph;
import wiggleCommon;


public static const uint VERTS_PER_INSTANCE = 6u;

struct WiggleInstance {
  uint2 startEnd  : ATTR0;
  float score     : ATTR1;
  uint  color     : ATTR2;
  float rowIndex  : ATTR3;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // scatter: local quad coord (-1..1) for disc AA.
  float2 localPos : TEXCOORD0;
};

// Which glyph the pass draws follows entirely from uniforms, so both stages
// derive it instead of passing a discriminator varying. That also keeps the
// fragment's branch in UNIFORM control flow, which WGSL requires around the
// derivatives it takes (a branch on a varying is rejected outright).
//
// Point-like scatter features become an AA disc; tiny ones a crisp square, like
// manhattan.slang. SMALL_POINT_MAX_DIAMETER and the disc SDF live in the shared
// pointGlyph module so the two stay in lockstep.
bool drawsDisc() {
  return u.renderingType == RENDERING_TYPE_SCATTER
    && u.scatterPointSize > SMALL_POINT_MAX_DIAMETER;
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
  float2 localPos = float2(0.0, 0.0);

  if (u.renderingType == RENDERING_TYPE_SCATTER) {
    // Point plot: every feature is a point marker centered on the bp midpoint,
    // never a bar (unlike manhattan.slang, which bars wide bins). scatterPointSize
    // is the disc diameter; tiny points draw as a crisp square like manhattan.
    float midX = (sx1 + sx2) * 0.5;
    float scoreYPx = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant) + rowTop;
    float2 q = quadLocal(vid);
    if (drawsDisc()) {
      // expand the quad by the AA pad so the disc's fade edge isn't clipped
      float radiusPx = u.scatterPointSize * 0.5;
      float2 local = q * 2.0 - float2(1.0, 1.0);
      float expand = discExpand(radiusPx);
      float halfPx = radiusPx * expand;
      sx = midX + pxToClipLen(local.x * halfPx, u.viewportWidth);
      sy = (1.0 - scoreYPx * pxToClip) + local.y * halfPx * pxToClip;
      localPos = local * expand;
    } else {
      // tiny point: pixel-snapped crisp filled square, no AA disc
      float4 p = crispSquareCornerClip(midX, scoreYPx, u.scatterPointSize, q,
                                       u.viewportWidth, u.canvasHeight);
      sx = p.x;
      sy = p.y;
    }
  } else {
    // The min-width floor, anchored at the bin's start so it grows the way the
    // Canvas2D `spanLeft` twin does. `u.viewportWidth` is CSS px (see
    // GpuWiggleRenderer), which is what makes the floor the same 1.5 CSS px at
    // every dpr rather than 1.5 device px.
    sx2 = extendToMinWidthX(sx1, sx2, MIN_FILL_WIDTH_PX, u.viewportWidth);
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
      float scoreY  = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant);
      float originY = scoreToY(u.origin,   u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant);
      topPx = min(scoreY, originY) + rowTop;
      botPx = max(scoreY, originY) + rowTop;
    }
    sy = lerp(1.0 - botPx * pxToClip, 1.0 - topPx * pxToClip, q.y);
  }

  float4 instColor = unpackRGBA(inst.color);
  float4 outColor;
  if (u.renderingType == RENDERING_TYPE_DENSITY) {
    float norm = normalizeScore(inst.score, u.domainYMin, u.domainYMax, u.scaleType, u.symlogConstant);
    float zeroNorm = normalizeScore(u.origin, u.domainYMin, u.domainYMax, u.scaleType, u.symlogConstant);
    outColor = float4(lerp(float3(1.0), instColor.rgb, densityGradientT(norm, zeroNorm)), 1.0);
  } else {
    outColor = float4(instColor.rgb, 1.0);
  }

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = outColor;
  o.localPos = localPos;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float4 outColor;
  if (drawsDisc()) {
    float alpha = discAlpha(fragIn.localPos);
    if (alpha <= 0.0) {
      discard;
    }
    outColor = float4(fragIn.color.rgb, fragIn.color.a * alpha);
  } else {
    // xyplot, density and the crisp small-point square are flat fills; the
    // multisampled target antialiases their edges.
    outColor = fragIn.color;
  }
  return outColor;
}

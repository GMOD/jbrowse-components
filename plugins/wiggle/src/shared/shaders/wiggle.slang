// Wiggle track renderer. One shader covers five rendering modes (xyplot,
// density, line, linecenter, scatter) branched on the `renderingType` uniform,
// plus linear/log scale branch. Bound to three triangle-list passes over the
// same per-instance vertex buffer: PASS_FILL draws 6-vert quads
// (xyplot/density/scatter); PASS_LINE draws 18-vert thick step-lines (3
// square-capped quad segments per feature); PASS_LINE_CENTER draws linecenter as
// a 6-vert capsule per feature under premultiplied max-blend (round-joined SDF
// line — see the RENDERING_TYPE_LINE_CENTER branch).
//! targets: wgsl, glsl

import hpmath;
import colorPack;
import pointGlyph;
import wiggleCommon;


public static const uint VERTS_PER_INSTANCE = 6u;

struct WiggleInstance {
  uint2 startEnd  : ATTR0;
  float score     : ATTR1;
  float prevScore : ATTR2;
  float nextScore : ATTR3;
  uint  color     : ATTR4;
  float rowIndex  : ATTR5;
  uint2 prevStartEnd : ATTR6;
  float prevScoreLine : ATTR7;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // scatter: local quad coord (-1..1) for disc AA. center-line: segment_coord —
  // signed px distance (along, perp) from the SEGMENT CENTER, so the fragment
  // can evaluate the capsule SDF, with segHalfLen the segment's half-length in
  // px (the capsule body extent).
  float2 localPos : TEXCOORD0;
  float  segHalfLen : TEXCOORD1;
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

bool drawsCapsule() {
  return u.renderingType == RENDERING_TYPE_LINE_CENTER;
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
  float2 localPos = float2(0.0, 0.0);
  float segHalfLen = 0.0;

  if (u.renderingType == RENDERING_TYPE_LINE) {
    // Thick step-line: each feature draws 3 triangle-quad segments (18 verts,
    // triangle-list) so the stroke honors u.lineWidth. Half-widths are in clip
    // space, computed separately for x and y because the two axes have
    // different px→clip scales. Each quad is square-capped (extended by the
    // half-width along its own length) so segments overlap at the joints and
    // corners fill with no gaps.
    //   seg 0: vertical at startX from prevScore → score (transition in)
    //   seg 1: horizontal at score across [startX, endX]
    //   seg 2: vertical at endX   from score → nextScore (transition out)
    // prevScore=0 encodes gapBefore (rise from zero); nextScore=0 encodes
    // gapAfter (drop to zero). When adjacent, nextScore==score collapses seg 2
    // to a square joint that fills the corner with the next feature's seg 0.
    uint seg = vid / 6u;
    float2 q = quadLocal(vid);
    float clipScoreY = rowScoreToClipY(inst.score,     rowTop, rowHeight, pxToClip);
    float clipPrevY  = rowScoreToClipY(inst.prevScore, rowTop, rowHeight, pxToClip);
    float clipNextY  = rowScoreToClipY(inst.nextScore, rowTop, rowHeight, pxToClip);
    float hwx = u.lineWidth * 0.5 * 2.0 / u.viewportWidth;
    float hwy = u.lineWidth * 0.5 * pxToClip;
    if (seg == 0u) {
      sx = lerp(sx1 - hwx, sx1 + hwx, q.x);
      sy = lerp(min(clipPrevY, clipScoreY) - hwy, max(clipPrevY, clipScoreY) + hwy, q.y);
    } else if (seg == 1u) {
      sx = lerp(min(sx1, sx2) - hwx, max(sx1, sx2) + hwx, q.x);
      sy = lerp(clipScoreY - hwy, clipScoreY + hwy, q.y);
    } else {
      sx = lerp(sx2 - hwx, sx2 + hwx, q.x);
      sy = lerp(min(clipScoreY, clipNextY) - hwy, max(clipScoreY, clipNextY) + hwy, q.y);
    }
  } else if (u.renderingType == RENDERING_TYPE_LINE_CENTER) {
    // Point-to-point line drawn as one CAPSULE per feature: the segment from the
    // previous feature's bp midpoint (prevStartEnd, prevScoreLine) to this one's
    // (midX, score), thickened to lineWidth with round caps of radius = half
    // width, connecting every consecutive pair in the source. Because adjacent
    // capsules share a round cap centred on the joint vertex, the max-blend
    // PASS_LINE_CENTER unions them into a seamless round join at ANY angle
    // (square caps left nicks on sharp diagonal bends; a zero-length degenerate
    // at a source start just draws a dot). The fragment reads segment_coord
    // (localPos) + segHalfLen to evaluate the capsule SDF. Standard instanced
    // SDF-line technique: https://github.com/rreusser/webgpu-instanced-lines /
    // https://almarklein.org/line_rendering.html.
    bool hasPrev = inst.prevStartEnd.x != NO_PREV_START;
    float midCurrX = (sx1 + sx2) * 0.5;
    // The previous midpoint is averaged in CLIP space from its start/end, the
    // same way midCurrX is, so consecutive capsules meet exactly. Averaging in
    // bp space instead would need a rounded integer midpoint, putting every
    // joint up to half a base off — invisible at wide zoom, tens of pixels of
    // overshoot at base resolution, where odd-width bins are the norm.
    float midPrevX = hasPrev
      ? (bpToClipX(inst.prevStartEnd.x, u) + bpToClipX(inst.prevStartEnd.y, u)) * 0.5
      : midCurrX;
    float currYpx = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop;
    float prevYpx = hasPrev
      ? scoreToY(inst.prevScoreLine, u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop
      : currYpx;
    // Build the capsule in px space (clip x → px via viewportWidth) so it stays
    // isotropic despite the differing per-axis px→clip scales, then convert the
    // per-vertex offset from the segment center back to clip.
    float centerClipX = (midPrevX + midCurrX) * 0.5;
    float centerYpx = (prevYpx + currYpx) * 0.5;
    float dxPx = (midCurrX - midPrevX) * u.viewportWidth * 0.5;
    float dyPx = currYpx - prevYpx;
    float len = sqrt(dxPx * dxPx + dyPx * dyPx);
    float2 dir = len > 1e-4 ? float2(dxPx, dyPx) / len : float2(1.0, 0.0);
    float2 nrm = float2(-dir.y, dir.x);
    // Quad half-extents bounding the capsule (stroke half-width + AA pad): the
    // caps add halfExtent past each end along the segment, and halfExtent across
    // it. localPos (segment_coord) is measured from the segment center.
    float halfExtent = u.lineWidth * 0.5 + AA_PAD_PX;
    float2 q = quadLocal(vid);
    float la = (q.x * 2.0 - 1.0) * (len * 0.5 + halfExtent);
    float lp = (q.y * 2.0 - 1.0) * halfExtent;
    sx = centerClipX + (dir.x * la + nrm.x * lp) * 2.0 / u.viewportWidth;
    sy = 1.0 - (centerYpx + dir.y * la + nrm.y * lp) * pxToClip;
    localPos = float2(la, lp);
    segHalfLen = len * 0.5;
  } else if (u.renderingType == RENDERING_TYPE_SCATTER) {
    // Point plot: every feature is a point marker centered on the bp midpoint,
    // never a bar (unlike manhattan.slang, which bars wide bins). scatterPointSize
    // is the disc diameter; tiny points draw as a crisp square like manhattan.
    float midX = (sx1 + sx2) * 0.5;
    float scoreYPx = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType) + rowTop;
    float2 q = quadLocal(vid);
    if (drawsDisc()) {
      // expand the quad by the AA pad so the disc's fade edge isn't clipped
      float radiusPx = u.scatterPointSize * 0.5;
      float2 local = q * 2.0 - float2(1.0, 1.0);
      float expand = discExpand(radiusPx);
      float halfPx = radiusPx * expand;
      sx = midX + local.x * halfPx * 2.0 / u.viewportWidth;
      sy = (1.0 - scoreYPx * pxToClip) + local.y * halfPx * pxToClip;
      localPos = local * expand;
    } else {
      // tiny point: pixel-snapped crisp filled square, no AA disc
      float2 centerPx = float2((midX + 1.0) * 0.5 * u.viewportWidth, scoreYPx);
      float2 vPx = crispSquareCornerPx(centerPx, u.scatterPointSize, q);
      sx = vPx.x / u.viewportWidth * 2.0 - 1.0;
      sy = 1.0 - vPx.y * pxToClip;
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
      float scoreY  = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType);
      float originY = scoreToY(u.origin,   u.domainYMin, u.domainYMax, rowHeight, u.scaleType);
      topPx = min(scoreY, originY) + rowTop;
      botPx = max(scoreY, originY) + rowTop;
    }
    sy = lerp(1.0 - botPx * pxToClip, 1.0 - topPx * pxToClip, q.y);
  }

  float4 instColor = unpackRGBA(inst.color);
  float4 outColor;
  if (u.renderingType == RENDERING_TYPE_DENSITY) {
    float norm = normalizeScore(inst.score, u.domainYMin, u.domainYMax, u.scaleType);
    float zeroNorm = normalizeScore(u.origin, u.domainYMin, u.domainYMax, u.scaleType);
    outColor = float4(lerp(float3(1.0), instColor.rgb, densityGradientT(norm, zeroNorm)), 1.0);
  } else {
    outColor = float4(instColor.rgb, 1.0);
  }

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = outColor;
  o.localPos = localPos;
  o.segHalfLen = segHalfLen;
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
  } else if (drawsCapsule()) {
    // Capsule SDF: px distance to the segment centerline. localPos =
    // segment_coord (along, perp) from the segment center; clamping the
    // along-overhang past ±segHalfLen to 0 gives rounded caps. Dividing by the
    // gradient magnitude gives an angle-uniform AA edge, and coincident caps let
    // the max-blend pass union adjacent capsules into a seamless round join at
    // any angle.
    //
    // Do NOT "simplify" this to a constant on the grounds that a proper SDF has
    // unit gradient. It does — but per CSS px, and ddx/ddy differentiate against
    // the DEVICE-px grid (the HAL sizes the backing store by getDpr() and sets
    // the viewport to canvas.width/height, while localPos is CSS px because
    // viewportWidth and canvasHeight both are). So this returns 1/dpr, and that
    // is the point: it is what keeps the ramp one OUTPUT pixel wide instead of
    // one CSS pixel, i.e. crisp rather than dpr-times softer on HiDPI. Replacing
    // it needs a devicePixelRatio uniform, which this shader does not have.
    // The synteny fill shaders hit exactly this and now pass one explicitly
    // (aaHalfPx in syntenyTypes.slang).
    float alongOver = max(abs(fragIn.localPos.x) - fragIn.segHalfLen, 0.0);
    float dist = length(float2(alongOver, fragIn.localPos.y));
    float aa = max(length(float2(ddx(dist), ddy(dist))), 1e-4);
    float alpha = clamp((u.lineWidth * 0.5 - dist) / aa + 0.5, 0.0, 1.0);
    if (alpha <= 0.0) {
      discard;
    }
    // PREMULTIPLIED output so same-color overlaps union (max) rather than
    // accumulating.
    outColor = float4(fragIn.color.rgb * alpha, alpha);
  } else {
    // Solid modes (xyplot/density/step-line) and the wide-bin bar are flat fills;
    // the multisampled target antialiases their edges.
    outColor = fragIn.color;
  }
  return outColor;
}

// The wiggle renderer's two stroked renderings: RENDERING_TYPE_LINE (thick
// step-line over the bar tops) and RENDERING_TYPE_LINE_CENTER (interpolated
// point-to-point line). Its sibling `wiggle.slang` draws the filled ones
// (xyplot, density, scatter); both import `wiggleCommon` for the uniform block
// and the score math, so where a score lands vertically is one decision.
//
// They are separate modules because they need different per-instance records
// and a module reflects exactly one instance struct. These two renderings are
// the only ones that read a neighbour: the step-line needs the previous and next
// scores, the center-line the previous feature's span and score. The filled
// renderings read none of that, and while all five shared one struct every fill
// buffer carried 20 bytes per feature that nothing read — which on a
// 1000-source multiwiggle is tens of MB against a 256MB maxBufferSize floor.
//
// The instance record below is deliberately in the same field order the single
// shared struct had, so the bytes the line passes receive are unchanged.
//! targets: wgsl, glsl
//! export-consts: STEP_LINE_VERTS

import antialias;
import hpmath;
import colorPack;
// for AA_PAD_PX, the capsule's antialias pad — same constant the disc uses
import pointGlyph;
import wiggleCommon;

// The center-line's capsule. A module carries one VERTS_PER_INSTANCE and these
// two renderings disagree, so PASS_LINE overrides it at the pass descriptor —
// with STEP_LINE_VERTS below, not with the product spelled out a second time in
// TypeScript, which is what it was.
public static const uint VERTS_PER_INSTANCE = 6u;

// The step-line's three square-capped quad segments per feature (see vs_main,
// which splits `SV_VertexID` by the same quad size `quadLocal` takes it apart
// with). 6 rather than VERTS_PER_INSTANCE: both are quads, but tying the
// step-line's segment size to the center-line's capsule would make an unrelated
// change to one silently resize the other.
static const uint STEP_LINE_SEGMENTS = 3u;
static const uint STEP_LINE_QUAD_VERTS = 6u;
static const uint STEP_LINE_VERTS = STEP_LINE_SEGMENTS * STEP_LINE_QUAD_VERTS;

struct WiggleLineInstance {
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
  // center-line: segment_coord — signed px distance (along, perp) from the
  // SEGMENT CENTER, so the fragment can evaluate the capsule SDF, with
  // segHalfLen the segment's half-length in px (the capsule body extent).
  float2 localPos : TEXCOORD0;
  nointerpolation float segHalfLen : TEXCOORD1;
};

// Which glyph the pass draws follows entirely from uniforms, so both stages
// derive it instead of passing a discriminator varying. That also keeps the
// fragment's branch in UNIFORM control flow, which WGSL requires around the
// derivatives it takes (a branch on a varying is rejected outright).
bool drawsCapsule() {
  return u.renderingType == RENDERING_TYPE_LINE_CENTER;
}

// Score → clip-space Y within a single row (line mode). Reads the y domain and
// scale type from the global uniforms.
float rowScoreToClipY(float score, float rowTop, float rowHeight, float pxToClip) {
  float yPx = scoreToY(score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant) + rowTop;
  return 1.0 - yPx * pxToClip;
}

[shader("vertex")]
VsOut vs_main(WiggleLineInstance inst, uint vid : SV_VertexID) {
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
    // Thick step-line: each feature draws STEP_LINE_SEGMENTS triangle-quad
    // segments (STEP_LINE_VERTS verts, triangle-list) so the stroke honors
    // u.lineWidth. Half-widths are in clip
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
    uint seg = vid / STEP_LINE_QUAD_VERTS;
    float2 q = quadLocal(vid);
    float clipScoreY = rowScoreToClipY(inst.score,     rowTop, rowHeight, pxToClip);
    float clipPrevY  = rowScoreToClipY(inst.prevScore, rowTop, rowHeight, pxToClip);
    float clipNextY  = rowScoreToClipY(inst.nextScore, rowTop, rowHeight, pxToClip);
    float hwx = pxToClipLen(u.lineWidth * 0.5, u.viewportWidth);
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
  } else {
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
    float currYpx = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant) + rowTop;
    float prevYpx = hasPrev
      ? scoreToY(inst.prevScoreLine, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant) + rowTop
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
    sx = centerClipX + pxToClipLen(dir.x * la + nrm.x * lp, u.viewportWidth);
    sy = 1.0 - (centerYpx + dir.y * la + nrm.y * lp) * pxToClip;
    localPos = float2(la, lp);
    segHalfLen = len * 0.5;
  }

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = float4(unpackRGBA(inst.color).rgb, 1.0);
  o.localPos = localPos;
  o.segHalfLen = segHalfLen;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (drawsCapsule()) {
    // Capsule SDF: px distance to the segment centerline. localPos =
    // segment_coord (along, perp) from the segment center; clamping the
    // along-overhang past ±segHalfLen to 0 gives rounded caps. Dividing by the
    // gradient magnitude gives an angle-uniform AA edge, and coincident caps let
    // the max-blend pass union adjacent capsules into a seamless round join at
    // any angle.
    //
    // Analytic, off `u.devicePixelRatio`, exactly as the dotplot capsule — the
    // same shape, and the same reason. `dist` is a TRUE Euclidean distance in
    // CSS px, so |grad dist| = 1 at every angle and one output pixel is
    // `2 * aaHalfPx(dpr)` with nothing to differentiate. It measured until the
    // xyplot bar gave this uniform block a devicePixelRatio; the measurement was
    // one output pixel wide too, but it took ddx/ddy of a quantity that comes
    // off a `max` clamp, so the 2x2 quads straddling the cap/body junction
    // differentiated a discontinuity. AA_PAD_PX above already leaves the ramp
    // room inside the geometry.
    float alongOver = max(abs(fragIn.localPos.x) - fragIn.segHalfLen, 0.0);
    float dist = length(float2(alongOver, fragIn.localPos.y));
    float alpha = aaRamp(u.lineWidth * 0.5 - dist,
                         2.0 * aaHalfPx(u.devicePixelRatio));
    if (alpha <= 0.0) {
      discard;
    }
    // PREMULTIPLIED output so same-color overlaps union (max) rather than
    // accumulating.
    return float4(fragIn.color.rgb * alpha, alpha);
  }
  // The step-line's quads stay flat fills, and that is a decision rather than an
  // omission: a feature draws three square-capped quads that DELIBERATELY
  // overlap at the joints so corners fill with no gaps, and consecutive features
  // overlap again. Per-fragment coverage on an edge two quads both cover
  // double-blends there — Kilgard's conflation, the self-overlap case — so the
  // step line would gain a lattice of darker joints where it has none today.
  // The rendering that wants an antialiased stroke is linecenter, above, whose
  // capsules union under max blend precisely so that overlap is free.
  return fragIn.color;
}

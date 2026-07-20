// Manhattan plot scatter renderer. Glyph per feature:
//   - ranged SV wider than a point  → horizontal bar from start→end
//   - insertion (glyph==1)          → inverted triangle marker
//   - LD index/lead SNP (glyph==2)  → diamond marker
//   - everything else (SNP/point)   → filled circle (disc)
// All are a 6-vertex quad; the fragment shader carves the shape. GWAS scores
// are conventionally pre-transformed (e.g. -log10 p), so we only do linear Y
// mapping — no log branch here.
//! targets: wgsl, glsl

import hpmath;
import colorPack;
import pointGlyph;

public static const uint VERTS_PER_INSTANCE = 6u;

struct ManhattanInstance {
  uint  absPosition : ATTR0;
  uint  absEnd      : ATTR1;
  float score       : ATTR2;
  uint  color       : ATTR3;
  uint  glyph       : ATTR4;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  domainYMin;
  float  domainYMax;
  float  zero;
  float  viewportWidth;
  float  pointRadius;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  // Shape discriminator passed to the fragment shader: 0 = disc, 1 = diamond,
  // 2 = inverted triangle, 3 = solid bar.
  float  shape    : TEXCOORD1;
};

// Shape discriminators for the fragment shader. AA_PAD_PX and
// SMALL_POINT_MAX_DIAMETER (and the disc SDF) come from the shared pointGlyph
// module so they stay in lockstep with wiggle.slang.
static const float SHAPE_DISC = 0.0;
static const float SHAPE_DIAMOND = 1.0;
static const float SHAPE_TRI = 2.0;
// >2.5 in the fragment shader = flat solid fill (ranged-SV bar, or the tiny
// square below).
static const float SHAPE_BAR = 3.0;
// 1/sqrt(5): normalizes the two slanted edges of the inverted triangle so the
// edge functions read as true perpendicular distances for antialiasing.
static const float INV_SQRT5 = 0.4472136;
// LocusZoom draws the index/lead SNP visibly larger than the other points so
// it reads as "the one that matters" at a glance, not just a color swap.
static const float INDEX_GLYPH_SCALE = 1.6;

[shader("vertex")]
VsOut vs_main(ManhattanInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  // Two-triangle quad corner (0/1 per axis); shared with the whole fleet.
  float2 q = quadLocal(v);
  float2 local = q * 2.0 - 1.0;
  bool xZero = q.x < 0.5;

  float startClipX = bpToClipX(inst.absPosition, u);
  float endClipX = bpToClipX(inst.absEnd, u);
  // max(range, 1e-6) guards a degenerate (min==max) domain from dividing by
  // zero (matches wiggle.slang and the JS scoreToY `|| 1` guard).
  float scoreNorm = clamp(
    (inst.score - u.domainYMin) / max(u.domainYMax - u.domainYMin, 1e-6),
    0.0,
    1.0,
  );
  float scoreYPx = (1.0 - scoreNorm) * u.canvasHeight;
  float centerClipY = yPxToClipY(scoreYPx, u.canvasHeight);

  // Genomic span in CSS px (clip width spans -1..1 across viewportWidth).
  // abs() because reversal is baked into bpRangeX (negated length), so
  // endClipX < startClipX on reversed regions — matches wiggle.slang.
  float spanPx = abs(endClipX - startClipX) * 0.5 * u.viewportWidth;
  bool isBar = spanPx > u.pointRadius * 2.0;

  VsOut o;
  o.color = unpackRGBA(inst.color);
  if (isBar) {
    // Horizontal bar from start→end, height 2*pointRadius px, centered on the
    // score. 1px AA pad on each x edge so adjacent bars don't shimmer.
    float padClipX = AA_PAD_PX * 2.0 / u.viewportWidth;
    // min/max so a reversed region (endClipX < startClipX) still spans the full
    // bar extent instead of drawing an inverted quad — matches wiggle.slang.
    float x = xZero ? (min(startClipX, endClipX) - padClipX)
                    : (max(startClipX, endClipX) + padClipX);
    float halfBandPx = u.pointRadius;
    float y = centerClipY + local.y * halfBandPx * 2.0 / u.canvasHeight;
    o.position = float4(x, y, 0.0, 1.0);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else if (inst.glyph == 0u && u.pointRadius * 2.0 <= SMALL_POINT_MAX_DIAMETER) {
    // tiny SNP point: pixel-snapped crisp filled square (no AA disc). Insertions
    // and the LD index/lead SNP keep their distinct marker even when small.
    float diamPx = u.pointRadius * 2.0;
    float2 centerPx = float2((startClipX + 1.0) * 0.5 * u.viewportWidth, scoreYPx);
    float2 vPx = crispSquareCornerPx(centerPx, diamPx, q);
    o.position = float4(vPx.x / u.viewportWidth * 2.0 - 1.0,
                        yPxToClipY(vPx.y, u.canvasHeight), 0.0, 1.0);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else {
    float expand = discExpand(u.pointRadius);
    float glyphScale = inst.glyph == 2u ? INDEX_GLYPH_SCALE : 1.0;
    float halfPx = u.pointRadius * expand * glyphScale;
    float dx = local.x * halfPx * 2.0 / u.viewportWidth;
    float dy = local.y * halfPx * 2.0 / u.canvasHeight;
    o.position = float4(startClipX + dx, centerClipY + dy, 0.0, 1.0);
    o.localPos = local * expand;
    o.shape = inst.glyph == 1u ? SHAPE_TRI : (inst.glyph == 2u ? SHAPE_DIAMOND : SHAPE_DISC);
  }
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (fragIn.shape > 2.5) {
    // Ranged-SV bar: solid fill, no marker AA.
    return fragIn.color;
  }
  float2 p = fragIn.localPos;
  float alpha;
  if (fragIn.shape > 1.5) {
    // Inverted triangle: top edge (-1,1)-(1,1), apex (0,-1). Each edge's signed
    // distance is positive inside; the min is the SDF used for the AA fade.
    float dTop = 1.0 - p.y;
    float dLeft = (2.0 * p.x + p.y + 1.0) * INV_SQRT5;
    float dRight = (-2.0 * p.x + p.y + 1.0) * INV_SQRT5;
    float coverage = min(dTop, min(dLeft, dRight));
    float aa = fwidth(coverage);
    alpha = smoothstep(-aa, aa, coverage);
  } else if (fragIn.shape > 0.5) {
    // Diamond (rhombus): L1-norm distance from center, positive inside,
    // zero at the four edges — the LocusZoom-style lead-SNP marker.
    float coverage = 1.0 - (abs(p.x) + abs(p.y));
    float aa = fwidth(coverage);
    alpha = smoothstep(-aa, aa, coverage);
  } else {
    alpha = discAlpha(p);
  }
  if (alpha <= 0.0) discard;
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

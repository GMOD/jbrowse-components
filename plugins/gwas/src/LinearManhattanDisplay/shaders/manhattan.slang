// Manhattan plot scatter renderer. Glyph per feature:
//   - ranged SV wider than a point  → horizontal bar from start→end
//   - GLYPH_INSERTION               → inverted triangle marker
//   - GLYPH_INDEX (LD lead SNP)     → diamond marker
//   - GLYPH_POINT (plain SNP)       → filled circle (disc)
// All are a 6-vertex quad; the fragment shader carves the shape. GWAS scores
// are conventionally pre-transformed (e.g. -log10 p), so we only do linear Y
// mapping — no log branch here.
//! targets: wgsl, glsl
//! export-consts: INDEX_GLYPH_SCALE, GLYPH_POINT, GLYPH_INSERTION, GLYPH_INDEX
//! js-export: scoreToYPx

import antialias;
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

// Score → canvas Y in px: clamp into the domain, invert (a bigger score sits
// higher), scale to the canvas. GWAS scores are conventionally pre-transformed
// (e.g. -log10 p), so there is no log branch — this is Manhattan's whole Y
// mapping. Factored out of vs_main and `//! js-export`ed because the Canvas2D
// draw AND the hover hit test both run the JS twin: a drift would move the grab
// target off the drawn point on the no-GPU path only.
//
// max(range, 1e-6) guards a degenerate (min == max) domain from dividing by
// zero. JS spelled that guard `|| 1`, and the two are NOT the same: `|| 1`
// invents a phantom unit-wide domain, so with bounds pinned to a single value
// a score half a unit above it drew half-way up the Canvas2D canvas while the
// GPU clamped it to the top. Pinning a degenerate domain means everything above
// it is off the top, which is what this does; the parity test pins the case.
float scoreToYPx(float score, float domainMin, float domainMax, float h) {
  float norm = clamp(
    (score - domainMin) / max(domainMax - domainMin, 1e-6),
    0.0,
    1.0,
  );
  return (1.0 - norm) * h;
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  // Shape discriminator passed to the fragment shader: 0 = disc, 1 = diamond,
  // 2 = inverted triangle, 3 = solid bar.
  nointerpolation float shape : TEXCOORD1;
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

// Per-feature glyph classes, as packed into `inst.glyph` by the RPC. The
// numbering is a contract between the worker, the Canvas2D/SVG draw and the
// branches below, so it is authored once here and `//! export-consts`ed into
// `ManhattanRPC/rpcTypes.ts` — which used to restate it, tied to this file only
// by a test that string-matched the branches out of the .slang source.
static const uint GLYPH_POINT = 0u;
static const uint GLYPH_INSERTION = 1u;
static const uint GLYPH_INDEX = 2u;

[shader("vertex")]
VsOut vs_main(ManhattanInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  // Two-triangle quad corner (0/1 per axis); shared with the whole fleet.
  float2 q = quadLocal(v);
  float2 local = q * 2.0 - 1.0;
  bool xZero = q.x < 0.5;

  float startClipX = bpToClipX(inst.absPosition, u);
  float endClipX = bpToClipX(inst.absEnd, u);
  float scoreYPx = scoreToYPx(inst.score, u.domainYMin, u.domainYMax, u.canvasHeight);
  float centerClipY = yPxToClipY(scoreYPx, u.canvasHeight);

  // Genomic span in CSS px (clip width spans -1..1 across viewportWidth).
  // abs() because reversal is baked into bpRangeX (negated length), so
  // endClipX < startClipX on reversed regions — matches wiggle.slang.
  float spanPx = clipLenToPx(abs(endClipX - startClipX), u.viewportWidth);
  bool isBar = spanPx > u.pointRadius * 2.0;

  VsOut o;
  o.color = unpackRGBA(inst.color);
  if (isBar) {
    // Horizontal bar from start→end, height 2*pointRadius px, centered on the
    // score. 1px AA pad on each x edge so adjacent bars don't shimmer.
    float padClipX = pxToClipLen(AA_PAD_PX, u.viewportWidth);
    // min/max so a reversed region (endClipX < startClipX) still spans the full
    // bar extent instead of drawing an inverted quad — matches wiggle.slang.
    float x = xZero ? (min(startClipX, endClipX) - padClipX)
                    : (max(startClipX, endClipX) + padClipX);
    float halfBandPx = u.pointRadius;
    float y = centerClipY + pxToClipLen(local.y * halfBandPx, u.canvasHeight);
    o.position = float4(x, y, 0.0, 1.0);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else if (inst.glyph == GLYPH_POINT && u.pointRadius * 2.0 <= SMALL_POINT_MAX_DIAMETER) {
    // tiny SNP point: pixel-snapped crisp filled square (no AA disc). Insertions
    // and the LD index/lead SNP keep their distinct marker even when small.
    float diamPx = u.pointRadius * 2.0;
    o.position = crispSquareCornerClip(startClipX, scoreYPx, diamPx, q,
                                       u.viewportWidth, u.canvasHeight);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else {
    float expand = discExpand(u.pointRadius);
    float glyphScale = inst.glyph == GLYPH_INDEX ? INDEX_GLYPH_SCALE : 1.0;
    float halfPx = u.pointRadius * expand * glyphScale;
    float dx = pxToClipLen(local.x * halfPx, u.viewportWidth);
    float dy = pxToClipLen(local.y * halfPx, u.canvasHeight);
    o.position = float4(startClipX + dx, centerClipY + dy, 0.0, 1.0);
    o.localPos = local * expand;
    o.shape = inst.glyph == GLYPH_INSERTION ? SHAPE_TRI
            : (inst.glyph == GLYPH_INDEX ? SHAPE_DIAMOND : SHAPE_DISC);
  }
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Each glyph only picks its SDF here; the AA derivative is taken once after
  // the branch, because WGSL rejects a derivative under a branch on a varying
  // ("must only be called from uniform control flow"). shape is constant per
  // primitive, so the shared ramp is exact.
  float2 p = fragIn.localPos;
  float coverage;
  if (fragIn.shape > 2.5) {
    // Ranged-SV bar: solid fill, no marker AA. A constant SDF has zero
    // gradient, so the ramp below saturates to alpha 1.
    coverage = 1.0;
  } else if (fragIn.shape > 1.5) {
    // Inverted triangle: top edge (-1,1)-(1,1), apex (0,-1). Each edge's signed
    // distance is positive inside; the min is the SDF used for the AA fade.
    float dTop = 1.0 - p.y;
    float dLeft = (2.0 * p.x + p.y + 1.0) * INV_SQRT5;
    float dRight = (-2.0 * p.x + p.y + 1.0) * INV_SQRT5;
    coverage = min(dTop, min(dLeft, dRight));
  } else if (fragIn.shape > 0.5) {
    // Diamond (rhombus): L1-norm distance from center, positive inside,
    // zero at the four edges — the LocusZoom-style lead-SNP marker.
    coverage = 1.0 - (abs(p.x) + abs(p.y));
  } else {
    coverage = discCoverage(p);
  }
  // One output pixel of ramp, from the SDF's own gradient — which is what lets
  // the four shapes above share a single line despite the diamond's L1 norm
  // carrying a sqrt(2) the others don't. See antialias.slang's glyphEdgeAlpha;
  // the ramp used to be open-coded here as `fwidth` used as a half-width, i.e.
  // 2 to 2.83 px wide.
  float alpha = glyphEdgeAlpha(coverage);
  if (alpha <= 0.0) discard;
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

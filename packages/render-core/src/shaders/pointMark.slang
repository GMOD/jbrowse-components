// The `point` mark shape: one glyph per instance, placed at a genomic x and at
// a y read off a per-instance value through a linear domain scale. The glyph
// channel picks between a disc, an inverted triangle and a diamond, and an
// instance whose x..x2 extent is wider than the glyph draws as a horizontal bar
// instead — the shape's own answer to "this datum has extent".
//
// All four are a 6-vertex quad; the fragment shader carves the shape.
//! targets: wgsl, glsl
//! export-consts: DIAMOND_GLYPH_SCALE, GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DIAMOND
//! js-export: valueToYPx, pointDrawsBar
// `valueToYPx` is `valueScale`'s; it is lifted here, once, for every consumer
// of the scale — the bar shape's painter and hit test import this twin too.

import antialias;
import hpmath;
import colorPack;
import pointGlyph;
import valueScale;

public static const uint VERTS_PER_INSTANCE = 6u;

struct PointMarkInstance {
  uint  x     : ATTR0;
  uint  x2    : ATTR1;
  float y     : ATTR2;
  uint  color : ATTR3;
  uint  glyph : ATTR4;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  domainMin;
  float  domainMax;
  float  zero;
  float  viewportWidth;
  float  radiusPx;
  // Read by the glyph pad alone; every other length in this block is CSS px.
  float  devicePixelRatio;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

// Whether an instance draws as an extent bar rather than a glyph: its span has
// to beat the glyph it would otherwise be, so a datum wider than its own marker
// stops pretending to be a point.
//
// `//! js-export`ed because this one decision is read in three places — the
// vertex branch below, the painter's rect-vs-glyph fork and the hit test's
// rect-vs-centre fork — and a display whose hit test took the other branch from
// the draw would grab a bar at its midpoint. `rectDrawsOutline` and `arrowDraws`
// are the same lift for the same reason.
bool pointDrawsBar(float spanPx, float radiusPx) {
  return spanPx > radiusPx * 2.0;
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  // Shape discriminator passed to the fragment shader: 0 = disc, 1 = diamond,
  // 2 = inverted triangle, 3 = solid bar.
  nointerpolation float shape : TEXCOORD1;
};

// Shape discriminators for the fragment shader. SMALL_POINT_MAX_DIAMETER and
// the disc SDF come from the shared pointGlyph module so they stay in lockstep
// with wiggle.slang.
static const float SHAPE_DISC = 0.0;
static const float SHAPE_DIAMOND = 1.0;
static const float SHAPE_TRI = 2.0;
// >2.5 in the fragment shader = flat solid fill (extent bar, or the tiny
// square below).
static const float SHAPE_BAR = 3.0;
// 1/sqrt(5): normalizes the two slanted edges of the inverted triangle so the
// edge functions read as true perpendicular distances for antialiasing.
static const float INV_SQRT5 = 0.4472136;
// The diamond is the shape's "singled out" glyph and draws visibly larger than
// the others, so it reads as the one that matters at a glance rather than as a
// colour swap. LocusZoom's lead-SNP convention, generalized.
static const float DIAMOND_GLYPH_SCALE = 1.6;

// The glyph channel's values. The numbering is a contract between whatever
// packs the channel, the Canvas2D painter and the branches below, so it is
// authored once here and `//! export-consts`ed.
static const uint GLYPH_DISC = 0u;
static const uint GLYPH_TRIANGLE = 1u;
static const uint GLYPH_DIAMOND = 2u;

[shader("vertex")]
VsOut vs_main(PointMarkInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  // Two-triangle quad corner (0/1 per axis); shared with the whole fleet.
  float2 q = quadLocal(v);
  float2 local = q * 2.0 - 1.0;
  bool xZero = q.x < 0.5;

  float startClipX = bpToClipX(inst.x, u);
  float endClipX = bpToClipX(inst.x2, u);
  float yPx = valueToYPx(inst.y, u.domainMin, u.domainMax, u.canvasHeight);
  float centerClipY = yPxToClipY(yPx, u.canvasHeight);

  // Genomic span in CSS px (clip width spans -1..1 across viewportWidth).
  // abs() because reversal is baked into bpRangeX (negated length), so
  // endClipX < startClipX on reversed regions — matches wiggle.slang.
  float spanPx = clipLenToPx(abs(endClipX - startClipX), u.viewportWidth);
  bool isBar = pointDrawsBar(spanPx, u.radiusPx);

  VsOut o;
  o.color = unpackRGBA(inst.color);
  if (isBar) {
    // Horizontal bar from x→x2, height 2*radiusPx px, centered on the value.
    //
    // NO SEAM PAD, and this reverses a deliberate one: `c7ff9d459d` kept the
    // 1 px overdraw on the claim that abutting bars leave hairline gaps without
    // it (the claim is that commit's, not the ADR-098 document's).
    // Measured against a fixture built to test that (38 of 39 boundaries on a
    // shared pixel row), padded and unpadded have the same interior gap
    // columns — none opens. A hairline at a fractional `fillRect` edge is a
    // Canvas2D problem and takes a Canvas2D pad; see `spanMark`'s `seamPx`.
    float x = xZero ? min(startClipX, endClipX) : max(startClipX, endClipX);
    float halfBandPx = u.radiusPx;
    float y = centerClipY + pxToClipLen(local.y * halfBandPx, u.canvasHeight);
    o.position = float4(x, y, 0.0, 1.0);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else if (inst.glyph == GLYPH_DISC && u.radiusPx * 2.0 <= SMALL_POINT_MAX_DIAMETER) {
    // tiny disc: pixel-snapped crisp filled square (no AA disc). The triangle
    // and the diamond keep their distinct marker even when small.
    float diamPx = u.radiusPx * 2.0;
    o.position = crispSquareCornerClip(startClipX, yPx, diamPx, q,
                                       u.viewportWidth, u.canvasHeight);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else {
    float expand = discExpand(u.radiusPx, u.devicePixelRatio);
    float glyphScale = inst.glyph == GLYPH_DIAMOND ? DIAMOND_GLYPH_SCALE : 1.0;
    float halfPx = u.radiusPx * expand * glyphScale;
    float dx = pxToClipLen(local.x * halfPx, u.viewportWidth);
    float dy = pxToClipLen(local.y * halfPx, u.canvasHeight);
    o.position = float4(startClipX + dx, centerClipY + dy, 0.0, 1.0);
    o.localPos = local * expand;
    o.shape = inst.glyph == GLYPH_TRIANGLE ? SHAPE_TRI
            : (inst.glyph == GLYPH_DIAMOND ? SHAPE_DIAMOND : SHAPE_DISC);
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
    // Extent bar: solid fill, no marker AA. A constant SDF has zero gradient,
    // so the ramp below saturates to alpha 1.
    coverage = 1.0;
  } else if (fragIn.shape > 1.5) {
    // Inverted triangle: top edge (-1,1)-(1,1), apex (0,-1). Each edge's signed
    // distance is positive inside; the min is the SDF used for the AA fade.
    float dTop = 1.0 - p.y;
    float dLeft = (2.0 * p.x + p.y + 1.0) * INV_SQRT5;
    float dRight = (-2.0 * p.x + p.y + 1.0) * INV_SQRT5;
    coverage = min(dTop, min(dLeft, dRight));
  } else if (fragIn.shape > 0.5) {
    // Diamond (rhombus): L1-norm distance from center, positive inside, zero at
    // the four edges.
    coverage = 1.0 - (abs(p.x) + abs(p.y));
  } else {
    coverage = discCoverage(p);
  }
  // One output pixel of ramp, from the SDF's own gradient — which is what lets
  // the four shapes above share a single line despite the diamond's L1 norm
  // carrying a sqrt(2) the others don't. See antialias.slang's glyphEdgeAlpha.
  float alpha = glyphEdgeAlpha(coverage);
  if (alpha <= 0.0) discard;
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

// The `point` and `rule` shapes, at a y read off a per-instance value through
// `valueScale`. A point is one glyph at the centre of its x..x2 extent, the
// glyph channel picking a disc, an inverted triangle, a diamond or a square. A
// rule (`u.rule`) is a bar across the extent, `2 * radiusPx` thick and at least
// `minWidthPx` wide.
//
// Each is a 6-vertex quad; the fragment shader carves the glyph.
//
// `row` is read through the bound row table, as `spanMark` reads it: a key
// resolved to its band and colour, or dropped off clip space where the table
// hides it. A pass binding no table (`rowTableKeys` −1) draws `row` as the band.
//! targets: wgsl, glsl
//! export-consts: DIAMOND_GLYPH_SCALE, DIAMOND_MITER_REACHES, TRIANGLE_MITER_REACHES, GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DIAMOND, GLYPH_SQUARE
//! js-export: valueToYPxScaled, pointYPx, pointRowYPx
// `valueScale`'s twin is lifted here, once, for the bar shape too.

import antialias;
import hpmath;
import colorPack;
import markColor;
import pointGlyph;
import rowTable;
import valueScale;

public static const uint VERTS_PER_INSTANCE = 6u;

struct PointMarkInstance {
  uint  x     : ATTR0;
  uint  x2    : ATTR1;
  float y     : ATTR2;
  uint  color : ATTR3;
  uint  glyph : ATTR4;
  uint  row   : ATTR5;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  domainMin;
  float  domainMax;
  // `scoreScale`'s scale-type vocabulary, for the declared y scale.
  int    valueScaleType;
  // Already resolved from the domain (`resolveSymlogConstant`); read by symlog alone.
  float  valueSymlogConstant;
  // `markColor`'s: 0 packs the instance's colour, 1 and 2 read its slot as a
  // value through the ramp below.
  int    rampMode;
  float  rampMin;
  float  rampMax;
  float  rampMidNorm;
  float  zero;
  float  viewportWidth;
  float  radiusPx;
  // CSS px per row band, the value scale ruling each on its own; the canvas
  // height where every instance is on row 0 (ADR-126).
  float  rowHeight;
  float  rowOffsetPx;
  // Whether the domain's minimum sits at the band's top.
  int    reverse;
  // Ends of the value range, inset by `glyphPaint`'s `pointInsetPx` where the
  // display wants its edge glyphs whole; 0 centres a point on the plot's edge.
  float  insetPx;
  // Read by the glyph pad alone; every other length in this block is CSS px.
  float  devicePixelRatio;
  int    rowTableKeys;
  int    rule;
  float  minWidthPx;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;
[[vk::binding(4, 0)]] Sampler2D<float4> rowTable;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  // Shape discriminator passed to the fragment shader: 0 = disc, 1 = diamond,
  // 2 = inverted triangle, 3 = solid fill.
  nointerpolation float shape : TEXCOORD1;
};

// Shape discriminators for the fragment shader. SMALL_POINT_MAX_DIAMETER and
// the disc SDF come from the shared pointGlyph module so they stay in lockstep
// with wiggle.slang.
static const float SHAPE_DISC = 0.0;
static const float SHAPE_DIAMOND = 1.0;
static const float SHAPE_TRI = 2.0;
// >2.5 in the fragment shader = flat solid fill (a rule, or the tiny square).
static const float SHAPE_BAR = 3.0;
// 1/sqrt(5): normalizes the two slanted edges of the inverted triangle so the
// edge functions read as true perpendicular distances for antialiasing.
static const float INV_SQRT5 = 0.4472136;
// The diamond is the shape's "singled out" glyph and draws visibly larger than
// the others, so it reads as the one that matters at a glance rather than as a
// colour swap. LocusZoom's lead-SNP convention, generalized.
static const float DIAMOND_GLYPH_SCALE = 1.6;

// How far past its boundary each glyph still inks where its quad binds, in ramp
// reaches. The disc's ramp is isotropic, so one. The diamond's quad binds on
// the four axes, where two L1 facets miter at a right angle: sqrt(2). The
// triangle's binds at its apex, where the two slanted edges miter much more
// sharply: sqrt(5), and padding one reach there cut the apex at alpha 0.276.
static const float DIAMOND_MITER_REACHES = 1.4142136;
static const float TRIANGLE_MITER_REACHES = 2.2360680;

// The shape's own anchor, the top of its row band. The vertex branch, the
// Canvas2D painter, the ink box and the hit test all read a value's y here.
float pointYPx(float value, float domainMin, float domainMax, float h, int scaleType, float insetPx, float symlogConstant) {
  return insetValueYPx(value, domainMin, domainMax, h, scaleType, insetPx, symlogConstant);
}

// A value's canvas y in the row band starting at `bandTop`, `h` tall, from
// its `pointYPx`: mirrored within the band under a reversed scale.
public float pointRowYPx(float bandTop, float h, int reverse, float valueYPx) {
  return bandTop + (reverse != 0 ? h - valueYPx : valueYPx);
}

// The glyph channel's values. The numbering is a contract between whatever
// packs the channel, the Canvas2D painter and the branches below, so it is
// authored once here and `//! export-consts`ed.
static const uint GLYPH_DISC = 0u;
static const uint GLYPH_TRIANGLE = 1u;
static const uint GLYPH_DIAMOND = 2u;
// A pixel-snapped filled square at any size, the small disc's crisp form.
static const uint GLYPH_SQUARE = 3u;

[shader("vertex")]
VsOut vs_main(PointMarkInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  // Two-triangle quad corner (0/1 per axis); shared with the whole fleet.
  float2 q = quadLocal(v);
  float2 local = q * 2.0 - 1.0;
  bool xZero = q.x < 0.5;

  VsOut o;
  RowPlacement place = rowTableLookup(rowTable, inst.row, u.rowTableKeys,
    markInstanceColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax, u.rampMidNorm));
  if (place.hidden) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    o.color = float4(0.0);
    o.localPos = float2(0.0);
    o.shape = SHAPE_BAR;
    return o;
  }

  float startClipX = bpToClipX(inst.x, u);
  float endClipX = bpToClipX(inst.x2, u);
  float yPx = pointRowYPx(rowBandTopPx(u.rowOffsetPx, u.rowHeight, place.slot), u.rowHeight, u.reverse, pointYPx(inst.y, u.domainMin, u.domainMax, u.rowHeight, u.valueScaleType, u.insetPx, u.valueSymlogConstant));
  float centerClipY = yPxToClipY(yPx, u.canvasHeight);

  o.color = place.color;
  float centerClipX = (startClipX + endClipX) * 0.5;
  if (u.rule != 0) {
    float farClipX = extendToMinWidthX(startClipX, endClipX, u.minWidthPx, u.viewportWidth);
    float x = xZero ? min(startClipX, farClipX) : max(startClipX, farClipX);
    float y = centerClipY + pxToClipLen(local.y * u.radiusPx, u.canvasHeight);
    o.position = float4(x, y, 0.0, 1.0);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else if (inst.glyph == GLYPH_SQUARE || (inst.glyph == GLYPH_DISC && u.radiusPx * 2.0 <= SMALL_POINT_MAX_DIAMETER)) {
    // tiny disc: pixel-snapped crisp filled square (no AA disc). The triangle
    // and the diamond keep their distinct marker even when small.
    float diamPx = u.radiusPx * 2.0;
    o.position = crispSquareCornerClip(centerClipX, yPx, diamPx, q,
                                       u.viewportWidth, u.canvasHeight);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else {
    bool diamond = inst.glyph == GLYPH_DIAMOND;
    float unitPx = u.radiusPx * (diamond ? DIAMOND_GLYPH_SCALE : 1.0);
    float reaches = inst.glyph == GLYPH_TRIANGLE ? TRIANGLE_MITER_REACHES
                  : (diamond ? DIAMOND_MITER_REACHES : 1.0);
    float expand = glyphExpand(unitPx, reaches, u.devicePixelRatio);
    float halfPx = unitPx * expand;
    float dx = pxToClipLen(local.x * halfPx, u.viewportWidth);
    float dy = pxToClipLen(local.y * halfPx, u.canvasHeight);
    o.position = float4(centerClipX + dx, centerClipY + dy, 0.0, 1.0);
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

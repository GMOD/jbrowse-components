// The `point` and `rule` shapes, at a y read off a per-instance value through
// `valueScale`. A point is one glyph at the centre of its x..x2 extent, the
// glyph channel picking a disc, an inverted triangle, a diamond or a square. A
// rule (`u.rule`) is a bar across the extent, `2 * radiusPx` thick and at least
// `minWidthPx` wide.
//
// Each is a 6-vertex quad; the fragment shader carves the glyph.
//
// `row` is read through the bound row table, as `spanMark` reads it: a key
// resolved to its band and color, or dropped off clip space where the table
// hides it. A pass binding no table (`rowTableKeys` −1) draws `row` as the band.
//! targets: wgsl, glsl
//! coverage: analytic
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
  // `markColor`'s: 0 packs the instance's color, 1 and 2 read its slot as a
  // value through the ramp below.
  int    rampMode;
  float  rampMin;
  float  rampMax;
  float  rampMidNorm;
  // `markColor`'s threshold: how many cuts are in use, the cuts four to a
  // vector, and the color of each interval between them.
  int    colorCutCount;
  float4 colorCuts[2];
  float4 colorBands[MAX_COLOR_BANDS];
  float  zero;
  float  viewportWidth;
  float  radiusPx;
  // Half the triangle's height, which is `radiusPx` but where a mark draws a
  // triangle wider than it is tall.
  float  triangleRadiusYPx;
  // CSS px per row band, the value scale ruling each on its own; the canvas
  // height where every instance is on row 0 (ADR-126).
  float  rowHeight;
  float  rowOffsetPx;
  // Whether the domain's minimum sits at the band's top.
  int    reverse;
  // Ends of the value range, inset by `glyphPaint`'s `pointInsetPx` where the
  // display wants its edge glyphs whole; 0 centres a point on the plot's edge.
  float  insetPx;
  // Read by the pads and box coverage; every other length here is CSS px.
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
  // 2 = inverted triangle, 3 = a box inked by its area (a rule, or the square).
  nointerpolation float shape : TEXCOORD1;
  // A flat shape's own box and the fragment's place, both CSS px, which its
  // coverage is measured from.
  float2 px : TEXCOORD2;
  nointerpolation float4 box : TEXCOORD3;
  // 1 where the box's x cuts stay hard: a rule's, so rules meeting end to end
  // share no seam, and its ends round to the device grid as `barMark`'s sides do.
  nointerpolation float hardX : TEXCOORD4;
};

// `boxInkCoverage`, or for a rule its y cuts' alone.
float boxCoverage(float2 p, float4 box, float dpr, bool hardX) {
  return hardX ? slabCoverage(p.y - box.y, p.y - box.w, dpr)
               : boxInkCoverage(p, box, dpr);
}

// Shape discriminators for the fragment shader. SMALL_POINT_MAX_DIAMETER and
// the disc SDF come from the shared pointGlyph module so they stay in lockstep
// with wiggle.slang.
static const float SHAPE_DISC = 0.0;
static const float SHAPE_DIAMOND = 1.0;
static const float SHAPE_TRI = 2.0;
// >2.5 in the fragment shader = a box, inked by its area (a rule, or the square).
static const float SHAPE_BAR = 3.0;
// 1/sqrt(5): normalizes the two slanted edges of the inverted triangle so the
// edge functions read as true perpendicular distances for antialiasing.
static const float INV_SQRT5 = 0.4472136;
// The diamond is the shape's "singled out" glyph and draws visibly larger than
// the others, so it reads as the one that matters at a glance rather than as a
// color swap. LocusZoom's lead-SNP convention, generalized.
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

  VsOut o;
  RowPlacement place = rowTableLookup(rowTable, inst.row, u.rowTableKeys,
    markScaleColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax, u.rampMidNorm, u.colorCutCount, u.colorCuts[0], u.colorCuts[1], u.colorBands));
  if (place.hidden) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    o.color = float4(0.0);
    o.localPos = float2(0.0);
    o.shape = SHAPE_BAR;
    o.px = float2(0.0);
    o.box = float4(0.0);
    o.hardX = 0.0;
    return o;
  }

  float startClipX = bpToClipX(inst.x, u);
  float endClipX = bpToClipX(inst.x2, u);
  float yPx = pointRowYPx(rowBandTopPx(u.rowOffsetPx, u.rowHeight, place.slot), u.rowHeight, u.reverse, pointYPx(inst.y, u.domainMin, u.domainMax, u.rowHeight, u.valueScaleType, u.insetPx, u.valueSymlogConstant));
  float centerClipY = yPxToClipY(yPx, u.canvasHeight);

  o.color = place.color;
  o.px = float2(0.0);
  o.box = float4(0.0);
  o.hardX = 0.0;
  float centerClipX = (startClipX + endClipX) * 0.5;
  if (u.rule != 0) {
    float pad = aaPx(u.devicePixelRatio);
    float farClipX = extendToMinWidthX(startClipX, endClipX, u.minWidthPx, u.viewportWidth);
    float a = clipXToPx(min(startClipX, farClipX), u.viewportWidth);
    float b = clipXToPx(max(startClipX, farClipX), u.viewportWidth);
    float4 box = float4(a, yPx - u.radiusPx, b, yPx + u.radiusPx);
    float2 p = float2(lerp(box.x, box.z, q.x), lerp(box.w + pad, box.y - pad, q.y));
    o.position = float4(pxToClipX(p.x, u.viewportWidth), yPxToClipY(p.y, u.canvasHeight), 0.0, 1.0);
    o.localPos = local;
    o.shape = SHAPE_BAR;
    o.px = p;
    o.box = box;
    o.hardX = 1.0;
  } else if (inst.glyph == GLYPH_SQUARE || (inst.glyph == GLYPH_DISC && u.radiusPx * 2.0 <= SMALL_POINT_MAX_DIAMETER)) {
    // tiny disc: the crisp square, its corner on the CSS px grid as the
    // painter's. The triangle and the diamond keep their marker when small.
    CrispSquareCorner c = crispSquareCorner(
      float2(clipXToPx(centerClipX, u.viewportWidth), yPx), u.radiusPx * 2.0, q,
      u.devicePixelRatio);
    o.position = float4(pxToClipX(c.px.x, u.viewportWidth), yPxToClipY(c.px.y, u.canvasHeight), 0.0, 1.0);
    o.localPos = local;
    o.shape = SHAPE_BAR;
    o.px = c.px;
    o.box = c.box;
  } else {
    bool diamond = inst.glyph == GLYPH_DIAMOND;
    float unitPx = u.radiusPx * (diamond ? DIAMOND_GLYPH_SCALE : 1.0);
    float reaches = inst.glyph == GLYPH_TRIANGLE ? TRIANGLE_MITER_REACHES
                  : (diamond ? DIAMOND_MITER_REACHES : 1.0);
    float unitYPx = inst.glyph == GLYPH_TRIANGLE ? u.triangleRadiusYPx : unitPx;
    float2 expand = float2(glyphExpand(unitPx, reaches, u.devicePixelRatio),
                           glyphExpand(unitYPx, reaches, u.devicePixelRatio));
    float dx = pxToClipLen(local.x * unitPx * expand.x, u.viewportWidth);
    float dy = pxToClipLen(local.y * unitYPx * expand.y, u.canvasHeight);
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
    // A box: `boxCoverage` below, after the derivative this constant feeds.
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
  if (fragIn.shape > 2.5) {
    alpha = boxCoverage(fragIn.px, fragIn.box, u.devicePixelRatio, fragIn.hardX > 0.5);
  }
  if (alpha <= 0.0) discard;
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

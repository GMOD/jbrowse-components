// The `link` mark shape: one instance is a stroked curve between two genomic
// positions — `x` on the displayed region whose payload holds the instance and
// `x2` on whichever displayed region the instance names, the same one,
// another, or none. The mark draws over the whole canvas rather than inside a
// block's column, so a curve crosses regions holding neither foot. Both feet
// place through a uniform table of the view's displayed regions, so a pan or
// zoom writes the table and no buffer.
//
// The curve is the alignments arc band's (arc.slang): a half-ellipse whose
// hull is a triangle strip inflated by the half stroke plus one antialiasing
// ramp, and a fragment that measures the true distance to the analytic
// curve, so the hull's facets never reach the picture. A pair wider than
// LINK_FAR_SCREEN_WIDTHS view widths degenerates to a circle whose legs
// rise from each real foot, built endpoint-relative so a radius in the
// millions of px cancels nothing. A foot the table cannot place draws a stem
// at the placed one, so an off-view mate still says it exists.
//
// The apex is a value on the display's y scale where the mark names one, else
// the pair's own half-width, clamped to the band under `dome` and left to
// leave it under `arc`.
//! targets: wgsl, glsl
//! topology: triangle-strip
//! coverage: analytic
//! export-consts: LINK_SHAPE_DOME, LINK_SHAPE_ARC, LINK_NO_REGION, LINK_ELSEWHERE, LINK_MAX_REGIONS, LINK_STEM_PX, LINK_FAR_SCREEN_WIDTHS, LINK_SIZE_CONSTANT, LINK_SIZE_SCALED, LINK_NO_SIZE, LINK_CURVE_SEGMENTS
//! js-export: linkApexPx, linkRadiiPx, linkStrokeWidthPx, linkValuePx
//! js-skip: linkIsFar — reached as a private helper inside the generated linkRadiiPx, the way arc.slang's arcIsFar is, so the far decision is shared without a second way to ask it

import antialias;
import colorPack;
import curveDistance;
import hpmath;
import markColor;
import scoreScale;
import valueScale;

public static const uint LINK_CURVE_SEGMENTS = 64u;
public static const uint VERTS_PER_INSTANCE = (LINK_CURVE_SEGMENTS + 1u) * 2u;
static const float PI = 3.14159265359;

public static const int LINK_SHAPE_DOME = 0;
public static const int LINK_SHAPE_ARC = 1;
// An `x2Region` the table has no entry for: the mate lies on no displayed
// region, so the instance draws its stem.
public static const uint LINK_NO_REGION = 0xFFFFFFFFu;
// An `x2Region` for an instance another region's payload draws: the far half
// of a pair both of whose ends have records, or a record fetched twice.
public static const uint LINK_ELSEWHERE = 0xFFFFFFFEu;
public static const uint LINK_MAX_REGIONS = 256u;
public static const float LINK_STEM_PX = 12.0;
// How many view widths a pair may span before its ellipse becomes a true
// circle, which the band clips down to near-vertical legs at each real foot.
// arc.slang's ARC_FAR_SCREEN_WIDTHS, with its reasoning: not 1, because a
// circle throws the pair's direction away, and the limit is tessellation.
public static const float LINK_FAR_SCREEN_WIDTHS = 3.0;
public static const int LINK_SIZE_CONSTANT = 0;
public static const int LINK_SIZE_SCALED = 1;
// The `size` lane's value for an instance holding no number, which takes the
// range's first px. A sentinel rather than NaN, which a vertex attribute may
// not carry through every driver's fast math.
public static const float LINK_NO_SIZE = -1.0e30;

static const float KIND_ELLIPSE = 0.0;
static const float KIND_CIRCLE = 1.0;
static const float KIND_STEM = 2.0;

struct LinkInstance {
  uint  x        : ATTR0;
  uint  x2       : ATTR1;
  uint  x2Region : ATTR2;
  float y        : ATTR3;
  float size     : ATTR4;
  uint  color    : ATTR5;
  uint  row      : ATTR6;
};

struct Uniforms {
  float  canvasHeight;
  float  devicePixelRatio;
  float  rowHeight;
  float  insetPx;
  float  domainMin;
  float  domainMax;
  int    valueScaleType;
  float  valueSymlogConstant;
  int    rampMode;
  float  rampMin;
  float  rampMax;
  // Whether the mark names a `y`: the apex is then the value's height.
  int    valued;
  int    linkShape;
  int    sizeMode;
  float  sizeConstantPx;
  float  sizeDomainMin;
  float  sizeDomainMax;
  int    sizeScaleType;
  float  sizeRangeMin;
  float  sizeRangeMax;
  float  canvasWidth;
  uint   regionCount;
  float  zero;
  // The table entry of the region whose payload is drawing, which every
  // instance's `x` is on; carried apart from the table so a region past its
  // end places.
  float4 ownEntry;
  // One entry per displayed region: (anchorPx, anchorBpHi, anchorBpLo,
  // signedPxPerBp), the anchor a bp of the region near the view so a foot's
  // offset from it stays inside float32.
  float4 regionTable[LINK_MAX_REGIONS];
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // Fragment position in the frame its curve is measured in: the ellipse's
  // centre, a far circle's leg foot, or the stem's foot.
  float2 local    : COLOR1;
  nointerpolation float2 radii : COLOR2;
  nointerpolation float  kind  : COLOR3;
  // The resolved half stroke width, carried so the hull the vertex stage
  // inflated and the ink the fragment measures are one width.
  nointerpolation float halfWidthPx : COLOR4;
  // Which leg of a far circle a vertex belongs to, ±1, and +1 throughout for
  // one connected curve. The strip has no break in it, so the quad between
  // the two legs' tips rasterizes; both tips carry the same `local`, so its
  // distance comes out ~0 and it inks a bar. The fragment discards where this
  // ramps between the legs.
  float  legSide : COLOR5;
};

float entryPx(uint bp, float4 r, float hpZero) {
  return r.x - hpViewportOffsetBp(hpSplitUint(bp), float3(r.y, r.z, 0.0), hpZero) * r.w;
}

bool linkIsFar(float halfWidthPx, float screenWidthPx) {
  return 2.0 * halfWidthPx > LINK_FAR_SCREEN_WIDTHS * screenWidthPx;
}

// The height above the baseline a mark's `y` value stands at: `valueScale`'s
// inset range, anchored at the band's bottom rather than a point's top.
public float linkValuePx(float value, float domainMin, float domainMax, float h, int scaleType, float insetPx, float symlogConstant) {
  return h - insetValueYPx(value, domainMin, domainMax, h, scaleType, insetPx, symlogConstant);
}

// The apex height of a pair, in CSS px above the baseline.
public float linkApexPx(float halfWidthPx, float reachPx, int linkShape, int valued, float valuePx) {
  if (valued != 0) { return valuePx; }
  if (linkShape == LINK_SHAPE_ARC) { return halfWidthPx; }
  return min(halfWidthPx, reachPx);
}

// The two radii of the half-ellipse a pair draws, or a true circle's once the
// pair is far. `//! js-export`ed as a pair, arc.slang's `arcRadiiPx` case: the
// decision IS the pair, and it is what the painter, the ink and the hit test
// read.
public float2 linkRadiiPx(float halfWidthPx, float apexPx, float screenWidthPx) {
  if (linkIsFar(halfWidthPx, screenWidthPx)) {
    return float2(halfWidthPx, halfWidthPx);
  }
  return float2(halfWidthPx, apexPx);
}

// An instance's stroke width: the constant, or its raw `size` value through
// the size scale into the px range, floored at 1.5 device px so the single
// antialiasing ramp always has room (arc-antialiasing-without-msaa.md).
public float linkStrokeWidthPx(float raw, int sizeMode, float constantPx, float domainMin, float domainMax, int scaleType, float rangeMin, float rangeMax, float dpr) {
  float w = constantPx;
  if (sizeMode == LINK_SIZE_SCALED) {
    w = raw > -1.0e29
      ? rangeMin + normalizeScore(raw, domainMin, domainMax, scaleType, 1.0) * (rangeMax - rangeMin)
      : rangeMin;
  }
  return max(w, 1.5 / dpr);
}

[shader("vertex")]
VsOut vs_main(LinkInstance inst, uint vid : SV_VertexID) {
  uint seg = vid / 2u;
  float side = (vid % 2u == 0u) ? -1.0 : 1.0;
  float t = float(seg) / float(LINK_CURVE_SEGMENTS);

  float strokeHalf = 0.5 * linkStrokeWidthPx(
    inst.size, u.sizeMode, u.sizeConstantPx, u.sizeDomainMin, u.sizeDomainMax,
    u.sizeScaleType, u.sizeRangeMin, u.sizeRangeMax, u.devicePixelRatio);
  float aaHalf = aaHalfPx(u.devicePixelRatio);
  float hw = strokeHalf + aaHalf;

  float baseY = u.rowHeight * float(inst.row) + u.rowHeight;
  float reach = max(u.rowHeight - u.insetPx, 0.0);
  float xPx = entryPx(inst.x, u.ownEntry, u.zero);
  bool placed = inst.x2Region < u.regionCount;
  float x2Px = placed ? entryPx(inst.x2, u.regionTable[inst.x2Region], u.zero) : xPx;

  // Positive on the outer flank; the frame's y is negative upward.
  float pad = side * hw;
  float2 local;
  float2 origin;
  float legDir = 1.0;
  float legSide = 1.0;
  float kind;
  float2 radii;
  if (!placed) {
    kind = KIND_STEM;
    radii = float2(0.0, LINK_STEM_PX);
    // The stem's tip is a round cap, so the quad runs one pad past it. Its foot
    // stops at the baseline, where every dome's feet stop.
    local = float2(pad, -t * (LINK_STEM_PX + hw));
    origin = float2(xPx, baseY);
  } else {
    float pairHalf = abs(x2Px - xPx) * 0.5;
    float valuePx = linkValuePx(inst.y, u.domainMin, u.domainMax, u.rowHeight,
                                u.valueScaleType, u.insetPx, u.valueSymlogConstant);
    float apex = linkApexPx(pairHalf, reach, u.linkShape, u.valued, valuePx);
    radii = linkRadiiPx(pairHalf, apex, u.canvasWidth);
    float2 ends = float2(min(xPx, x2Px), max(xPx, x2Px));
    if (linkIsFar(pairHalf, u.canvasWidth)) {
      kind = KIND_CIRCLE;
      float legSweep = legSweepAngle(radii.x, reach + strokeHalf + aaHalf);
      // Two legs, each built from ITS OWN foot outward with the half-angle
      // identity, so a radius past 1e6 px cancels nothing.
      float2 leg = wideCircleLeg(seg, LINK_CURVE_SEGMENTS, legSweep);
      float b = leg.y;
      float halfStep =
        0.5 * wideCircleLegStep(seg, LINK_CURVE_SEGMENTS, legSweep);
      local = wideCircleHullPoint(sin(b), sin(b * 0.5), cos(halfStep),
                                  radii.x, pad);
      local.y = -local.y;
      origin = float2(leg.x > 0.0 ? ends.y : ends.x, baseY);
      legDir = leg.x;
      legSide = legDir;
    } else {
      kind = KIND_ELLIPSE;
      float a = t * PI;
      float halfStep = PI / (2.0 * float(LINK_CURVE_SEGMENTS));
      local = ellipseHullPoint(cos(a), sin(a), cos(halfStep), sin(halfStep),
                               radii.x, radii.y, pad);
      local.y = -local.y;
      origin = float2((xPx + x2Px) * 0.5, baseY);
    }
  }

  float2 screen = origin + float2(legDir * local.x, local.y);

  VsOut o;
  o.position = inst.x2Region == LINK_ELSEWHERE
    ? float4(-2.0, -2.0, 0.0, 1.0)
    : float4(
      screen.x / u.canvasWidth * 2.0 - 1.0,
      yPxToClipY(screen.y, u.canvasHeight),
      0.0, 1.0);
  o.color = markInstanceColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax);
  o.local = local;
  o.radii = radii;
  o.kind = kind;
  o.halfWidthPx = strokeHalf;
  o.legSide = legSide;
  return o;
}

// Perpendicular distance in CSS px from this fragment to its analytic curve.
float linkDistance(VsOut i) {
  if (i.kind >= 1.5) {
    float y = clamp(i.local.y, -i.radii.y, 0.0);
    return length(float2(i.local.x, i.local.y - y));
  }
  if (i.kind >= 0.5) { return distToWideCircle(i.local, i.radii.x); }
  return sdEllipse(i.local, i.radii);
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (abs(fragIn.legSide) < 0.999) { discard; }
  // |∇d| is 1 per CSS px, so the ramp is a constant number of device pixels.
  float alpha = edgeCoverage(fragIn.halfWidthPx - linkDistance(fragIn), u.devicePixelRatio);
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

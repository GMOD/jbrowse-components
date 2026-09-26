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
// at the placed one, so an off-view mate still says it exists. A foot may
// carry a breakend tick along the baseline, pointing along the arm its
// junction keeps. Under `line`
// the pair is a straight segment at the apex height instead, GenomeSpy's
// fourth link shape.
//
// The apex is a value on the display's y scale where the mark names one, else
// the pair's own half-width, clamped to the band under `dome` and left to
// leave it under `arc`. A reversed scale puts the baseline at the band's top
// and the curve below it.
//! targets: wgsl, glsl
//! topology: triangle-strip
//! coverage: analytic
//! export-consts: LINK_SHAPE_DOME, LINK_SHAPE_ARC, LINK_SHAPE_LINE, LINK_LINE_MIN_PX, LINK_NO_REGION, LINK_ELSEWHERE, LINK_MAX_REGIONS, LINK_STEM_PX, LINK_FOOT_PX, LINK_FAR_SCREEN_WIDTHS, LINK_SIZE_CONSTANT, LINK_SIZE_SCALED, LINK_NO_SIZE, LINK_CURVE_SEGMENTS
//! js-export: linkApexPx, linkRadiiPx, linkStrokeWidthPx, linkValuePx, linkBaseYPx, linkFootLenPx
//! js-skip: linkIsFar — reached as a private helper inside the generated linkRadiiPx, the way arc.slang's arcIsFar is, so the far decision is shared without a second way to ask it

import antialias;
import colorPack;
import curveDistance;
import hpmath;
import markColor;
import scoreScale;
import valueScale;

public static const uint LINK_CURVE_SEGMENTS = 64u;
static const uint CURVE_VERTS = (LINK_CURVE_SEGMENTS + 1u) * 2u;
// Each foot's block of the strip: the join's repeated vertex, then its quad
// with the first corner doubled, so both joins are degenerate triangles.
static const uint FOOT_VERTS = 6u;
public static const uint VERTS_PER_INSTANCE = CURVE_VERTS + 2u * FOOT_VERTS;
static const float PI = 3.14159265359;

public static const int LINK_SHAPE_DOME = 0;
public static const int LINK_SHAPE_ARC = 1;
public static const int LINK_SHAPE_LINE = 2;
// The shortest segment a `line` draws, widened about its midpoint, so a pair
// under a pixel apart still paints.
public static const float LINK_LINE_MIN_PX = 2.5;
// An `x2Region` the table has no entry for: the mate lies on no displayed
// region, so the instance draws its stem.
public static const uint LINK_NO_REGION = 0xFFFFFFFFu;
// An `x2Region` for an instance another region's payload draws: the far half
// of a pair both of whose ends have records, or a record fetched twice.
public static const uint LINK_ELSEWHERE = 0xFFFFFFFEu;
public static const uint LINK_MAX_REGIONS = 256u;
public static const float LINK_STEM_PX = 12.0;
// How long a breakend foot is where its region has the room: a tick along
// the baseline over the arm its junction keeps, BreakpointSplitView's length.
public static const float LINK_FOOT_PX = 20.0;
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
static const float KIND_LINE = 3.0;
static const float KIND_FOOT = 4.0;

struct LinkInstance {
  uint  x        : ATTR0;
  uint  x2       : ATTR1;
  uint  x2Region : ATTR2;
  float y        : ATTR3;
  float size     : ATTR4;
  uint  color    : ATTR5;
  uint  row      : ATTR6;
  uint  feet     : ATTR7;
};

struct Uniforms {
  float  canvasHeight;
  float  devicePixelRatio;
  float  rowHeight;
  float  rowOffsetPx;
  int    reverse;
  float  stemPx;
  float  dashPx;
  float  gapPx;
  float  footPx;
  float  insetPx;
  float  domainMin;
  float  domainMax;
  int    valueScaleType;
  float  valueSymlogConstant;
  int    rampMode;
  float  rampMin;
  float  rampMax;
  float  rampMidNorm;
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
  // The own region's screen extent, (leftPx, rightPx), which bounds its foot.
  float4 ownSpan;
  // One entry per displayed region: (anchorPx, anchorBpHi, anchorBpLo,
  // signedPxPerBp), the anchor a bp of the region near the view so a foot's
  // offset from it stays inside float32.
  float4 regionTable[LINK_MAX_REGIONS];
  // Each region's screen extent, two to an element: (left, right) of region
  // 2i in xy and of region 2i + 1 in zw.
  float4 regionSpan[LINK_MAX_REGIONS / 2u];
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // Fragment position in the frame its curve is measured in, y negative away
  // from the baseline: the ellipse's centre, a far circle's leg foot, a
  // stem's foot, or a line's left end; along and across a breakend foot.
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
  if (linkShape == LINK_SHAPE_LINE) { return 0.0; }
  if (linkShape == LINK_SHAPE_ARC) { return halfWidthPx; }
  return min(halfWidthPx, reachPx);
}

// The baseline of a row's band, in canvas px: its bottom, or its top under a
// reversed scale.
public float linkBaseYPx(float rowOffsetPx, float rowHeight, uint row, int reverse) {
  return rowOffsetPx + rowHeight * float(row) + (reverse != 0 ? 0.0 : rowHeight);
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

// A foot's genomic direction off the `feet` lane: two bits per foot, 1 for
// forward and 2 for reverse, the `x` foot in the low pair.
float footDir(uint feet, uint shift) {
  uint d = (feet >> shift) & 3u;
  return d == 1u ? 1.0 : (d == 2u ? -1.0 : 0.0);
}

float2 regionSpanPx(uint region) {
  float4 s = u.regionSpan[region / 2u];
  return (region % 2u) == 0u ? s.xy : s.zw;
}

// How far a foot at `x` runs in screen direction `dir`, up to `footPx` and
// no further than its own region's edge, so it stops at a seam.
public float linkFootLenPx(float x, float dir, float leftPx, float rightPx, float footPx) {
  return max(0.0, min(footPx, dir > 0.0 ? rightPx - x : x - leftPx));
}

// What every vertex of one instance shares.
struct LinkEnv {
  float strokeHalf;
  float hw;
  float baseY;
  float ySign;
  float reach;
  float xPx;
  float x2Px;
  bool placed;
};

struct LinkVertex {
  float2 screen;
  float2 local;
  float2 radii;
  float kind;
  float legSide;
};

LinkVertex curveVertex(LinkInstance inst, LinkEnv e, uint seg, float side) {
  float t = float(seg) / float(LINK_CURVE_SEGMENTS);
  // Positive on the outer flank; the frame's y is negative upward.
  float pad = side * e.hw;
  float2 origin;
  float legDir = 1.0;
  LinkVertex v;
  v.legSide = 1.0;
  if (!e.placed) {
    v.kind = KIND_STEM;
    v.radii = float2(0.0, u.stemPx);
    // The stem's tip is a round cap, so the quad runs one pad past it. Its foot
    // stops at the baseline, where every dome's feet stop.
    v.local = float2(pad, -t * (u.stemPx + e.hw));
    origin = float2(e.xPx, e.baseY);
  } else {
    float pairHalf = abs(e.x2Px - e.xPx) * 0.5;
    float valuePx = linkValuePx(inst.y, u.domainMin, u.domainMax, u.rowHeight,
                                u.valueScaleType, u.insetPx, u.valueSymlogConstant);
    float apex = linkApexPx(pairHalf, e.reach, u.linkShape, u.valued, valuePx);
    v.radii = linkRadiiPx(pairHalf, apex, u.canvasWidth);
    float2 ends = float2(min(e.xPx, e.x2Px), max(e.xPx, e.x2Px));
    if (u.linkShape == LINK_SHAPE_LINE) {
      v.kind = KIND_LINE;
      float len = max(2.0 * pairHalf, LINK_LINE_MIN_PX);
      v.radii = float2(len, 0.0);
      v.local = float2(t * len, pad);
      origin = float2((e.xPx + e.x2Px) * 0.5 - len * 0.5, e.baseY - apex * e.ySign);
    } else if (linkIsFar(pairHalf, u.canvasWidth)) {
      v.kind = KIND_CIRCLE;
      float legSweep = legSweepAngle(v.radii.x, e.reach + e.hw);
      // Two legs, each built from ITS OWN foot outward with the half-angle
      // identity, so a radius past 1e6 px cancels nothing.
      float2 leg = wideCircleLeg(seg, LINK_CURVE_SEGMENTS, legSweep);
      float b = leg.y;
      float halfStep =
        0.5 * wideCircleLegStep(seg, LINK_CURVE_SEGMENTS, legSweep);
      v.local = wideCircleHullPoint(sin(b), sin(b * 0.5), cos(halfStep),
                                    v.radii.x, pad);
      v.local.y = -v.local.y;
      origin = float2(leg.x > 0.0 ? ends.y : ends.x, e.baseY);
      legDir = leg.x;
      v.legSide = legDir;
    } else {
      v.kind = KIND_ELLIPSE;
      float a = t * PI;
      float halfStep = PI / (2.0 * float(LINK_CURVE_SEGMENTS));
      v.local = ellipseHullPoint(cos(a), sin(a), cos(halfStep), sin(halfStep),
                                 v.radii.x, v.radii.y, pad);
      v.local.y = -v.local.y;
      origin = float2((e.xPx + e.x2Px) * 0.5, e.baseY);
    }
  }
  v.screen = origin + float2(legDir * v.local.x, v.local.y * e.ySign);
  return v;
}

// Corner `c` (0-3, strip order) of foot `f`'s quad, or undefined where the
// foot draws nothing, reported through `present`.
LinkVertex footCorner(LinkInstance inst, LinkEnv e, uint f, uint c, out bool present) {
  float x = f == 0u ? e.xPx : e.x2Px;
  float4 entry = f == 0u ? u.ownEntry : u.regionTable[inst.x2Region];
  float2 span = f == 0u ? u.ownSpan.xy : regionSpanPx(inst.x2Region);
  float dir = footDir(inst.feet, f * 2u) * sign(entry.w);
  float len = linkFootLenPx(x, dir, span.x, span.y, u.footPx);
  present = dir != 0.0 && len > 0.0 && (f == 0u || e.placed);
  float along = (c >= 2u) ? len : 0.0;
  float across = (c % 2u == 0u) ? -e.hw : e.hw;
  LinkVertex v;
  v.kind = KIND_FOOT;
  v.radii = float2(len, 0.0);
  v.legSide = 1.0;
  v.local = float2(along, across);
  v.screen = float2(x + dir * along, e.baseY - e.ySign * e.strokeHalf + across);
  return v;
}

// The vertex a foot's block of the strip starts from: the one before it, so
// the join is two degenerate triangles.
LinkVertex footBlockStart(LinkInstance inst, LinkEnv e, uint f) {
  LinkVertex tail = curveVertex(inst, e, LINK_CURVE_SEGMENTS, 1.0);
  if (f == 0u) { return tail; }
  bool first;
  LinkVertex last = footCorner(inst, e, 0u, 3u, first);
  return first ? last : tail;
}

// Vertex `k` of foot `f`'s six: the block's start repeated, then the quad
// with its first corner doubled. A foot that draws nothing repeats the start.
LinkVertex footVertex(LinkInstance inst, LinkEnv e, uint f, uint k) {
  LinkVertex start = footBlockStart(inst, e, f);
  if (k == 0u) { return start; }
  bool present;
  LinkVertex v = footCorner(inst, e, f, k <= 2u ? 0u : k - 2u, present);
  return present ? v : start;
}

[shader("vertex")]
VsOut vs_main(LinkInstance inst, uint vid : SV_VertexID) {
  LinkEnv e;
  e.strokeHalf = 0.5 * linkStrokeWidthPx(
    inst.size, u.sizeMode, u.sizeConstantPx, u.sizeDomainMin, u.sizeDomainMax,
    u.sizeScaleType, u.sizeRangeMin, u.sizeRangeMax, u.devicePixelRatio);
  e.hw = e.strokeHalf + aaHalfPx(u.devicePixelRatio);
  e.baseY = linkBaseYPx(u.rowOffsetPx, u.rowHeight, inst.row, u.reverse);
  e.ySign = u.reverse != 0 ? -1.0 : 1.0;
  e.reach = max(u.rowHeight - u.insetPx, 0.0);
  e.xPx = entryPx(inst.x, u.ownEntry, u.zero);
  e.placed = inst.x2Region < u.regionCount;
  e.x2Px = e.placed ? entryPx(inst.x2, u.regionTable[inst.x2Region], u.zero) : e.xPx;

  LinkVertex v;
  if (vid < CURVE_VERTS) {
    v = curveVertex(inst, e, vid / 2u, (vid % 2u == 0u) ? -1.0 : 1.0);
  } else {
    uint j = vid - CURVE_VERTS;
    v = footVertex(inst, e, j / FOOT_VERTS, j % FOOT_VERTS);
  }

  VsOut o;
  o.position = inst.x2Region == LINK_ELSEWHERE
    ? float4(-2.0, -2.0, 0.0, 1.0)
    : float4(
      v.screen.x / u.canvasWidth * 2.0 - 1.0,
      yPxToClipY(v.screen.y, u.canvasHeight),
      0.0, 1.0);
  o.color = markInstanceColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax, u.rampMidNorm);
  o.local = v.local;
  o.radii = v.radii;
  o.kind = v.kind;
  o.halfWidthPx = e.strokeHalf;
  o.legSide = v.legSide;
  return o;
}

// Perpendicular distance in CSS px from this fragment to its analytic curve.
float linkDistance(VsOut i) {
  if (i.kind >= 2.5) {
    float x = clamp(i.local.x, 0.0, i.radii.x);
    return length(float2(i.local.x - x, i.local.y));
  }
  if (i.kind >= 1.5) {
    float y = clamp(i.local.y, -i.radii.y, 0.0);
    return length(float2(i.local.x, i.local.y - y));
  }
  if (i.kind >= 0.5) { return distToWideCircle(i.local, i.radii.x); }
  return sdEllipse(i.local, i.radii);
}

// How far along a straight segment's axis the fragment is, from the end the
// dash pattern starts at; a curve carries no dash.
float linkDashAlong(VsOut i) {
  if (i.kind >= 3.5) { return -1.0; }
  if (i.kind >= 2.5) { return i.local.x; }
  if (i.kind >= 1.5) { return -i.local.y; }
  return -1.0;
}

float linkDash(VsOut i) {
  float along = linkDashAlong(i);
  return u.dashPx > 0.0 && along >= 0.0
    ? dashCoverage(along, u.dashPx, u.gapPx, u.devicePixelRatio)
    : 1.0;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (abs(fragIn.legSide) < 0.999) { discard; }
  // |∇d| is 1 per CSS px, so the ramp is a constant number of device pixels.
  float alpha = edgeCoverage(fragIn.halfWidthPx - linkDistance(fragIn), u.devicePixelRatio)
    * linkDash(fragIn);
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

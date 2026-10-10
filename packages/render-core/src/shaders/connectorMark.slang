// The `connector` mark shape: one instance is a stroked cubic between two
// placed points, `x` on the displayed region whose payload holds the instance
// and `x2` on the region `x2Region` names, each at the centre of its own row.
// Both place through a uniform table of the view's displayed regions, so a
// pan or zoom writes the table and no buffer. The curve is the breakpoint and
// read-pair connector both views draw: its handles leave each end along the
// read's direction on screen, flipped at a split junction's leading end, and
// the pair of controls lifts into a bow over a shared row or drops by `bend`
// px into a dip, the depth a caller sizes to the room it has.
//
// The hull is a triangle strip along the curve inflated by the half stroke and
// one antialiasing ramp, and the fragment fades on its distance across, which
// the strip's straight sections carry exactly. An instance can end in an open
// arrowhead, and a straight one can be dashed.
//! targets: wgsl, glsl
//! topology: triangle-strip
//! coverage: analytic
//! export-consts: CONNECTOR_CURVE_SEGMENTS, CONNECTOR_BOW, CONNECTOR_MAX_REACH_PX, CONNECTOR_APEX_RATIO, CONNECTOR_MAX_HANDLE_PX, CONNECTOR_MINUS_1, CONNECTOR_MINUS_2, CONNECTOR_LEADING_2, CONNECTOR_STRAIGHT, CONNECTOR_DASHED, CONNECTOR_ARROW
//! js-export: connectorBudgetPx, connectorHandlePx, connectorLiftPx, connectorTangent, connectorStrokePx

import antialias;
import colorPack;
import hpmath;
import viewRegion;

public static const uint CONNECTOR_CURVE_SEGMENTS = 48u;
static const uint CURVE_VERTS = (CONNECTOR_CURVE_SEGMENTS + 1u) * 2u;
// Each arrowhead arm's block of the strip: the join's repeated vertex, then its
// quad with the first corner doubled, so both joins are degenerate triangles.
static const uint ARM_VERTS = 6u;
public static const uint VERTS_PER_INSTANCE = CURVE_VERTS + 2u * ARM_VERTS;

// The `bend` lane's value for a connector that bows up over its row rather
// than dipping by a set depth.
public static const float CONNECTOR_BOW = -1.0e30;
// Every shaping term stays under this fraction of the span the curve covers,
// so a handle never folds the cubic back over itself.
static const float CONNECTOR_SPAN_FACTOR = 0.3;
public static const float CONNECTOR_MAX_HANDLE_PX = 200.0;
// The handles are horizontal, so a tall vertical gap only widens the bulge;
// past this it earns no more.
static const float CONNECTOR_MAX_VERTICAL_SPAN_PX = 150.0;
// A symmetric cubic's extreme sits 3/4 of the way from its ends to its
// controls, so a dip asked to reach a depth puts the controls 4/3 past it.
public static const float CONNECTOR_APEX_RATIO = 0.75;
static const float CONNECTOR_MAX_BOW_PX = 30.0;
// The deepest a dip may reach below its ends, a ceiling on `bend`.
public static const float CONNECTOR_MAX_REACH_PX = 110.0;

// The `bits` lane.
public static const uint CONNECTOR_MINUS_1 = 1u;
public static const uint CONNECTOR_MINUS_2 = 2u;
public static const uint CONNECTOR_LEADING_2 = 4u;
public static const uint CONNECTOR_STRAIGHT = 8u;
public static const uint CONNECTOR_DASHED = 16u;
public static const uint CONNECTOR_ARROW = 32u;

struct ConnectorInstance {
  uint  x        : ATTR0;
  uint  x2       : ATTR1;
  uint  x2Region : ATTR2;
  uint  row      : ATTR3;
  uint  row2     : ATTR4;
  float bend     : ATTR5;
  float width    : ATTR6;
  uint  color    : ATTR7;
  uint  bits     : ATTR8;
};

struct Uniforms {
  float  canvasHeight;
  float  canvasWidth;
  float  devicePixelRatio;
  // Canvas y of row 0's centre, and the px between two rows' centres.
  float  rowOffsetPx;
  float  rowPitchPx;
  float  maxHandlePx;
  float  dashPx;
  float  gapPx;
  float  arrowPx;
  uint   regionCount;
  float  zero;
  // The table entry of the region whose payload is drawing, which every
  // instance's `x` is on.
  float4 ownEntry;
  float4 regionTable[VIEW_REGION_MAX];
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // Signed px from the centreline, and px along it from the `x` end.
  float  across   : COLOR1;
  float  along    : COLOR2;
  nointerpolation float halfWidthPx : COLOR3;
  nointerpolation float dashed      : COLOR4;
};

// How much shaping a curve may spend: a share of the distance it covers.
public float connectorBudgetPx(float dx, float dy) {
  float h = min(abs(dy), CONNECTOR_MAX_VERTICAL_SPAN_PX);
  return sqrt(dx * dx + h * h) * CONNECTOR_SPAN_FACTOR;
}

public float connectorHandlePx(float budget, float maxHandlePx) {
  return min(maxHandlePx, budget);
}

// How far both controls rise above their ends, negative for a dip. A bow fades
// as the rows separate, since a cross-row curve already has height; a dip is
// not held to the budget, because a vertical offset cannot fold the curve.
public float connectorLiftPx(float budget, float dy, float bend) {
  return bend < -1.0e29
    ? min(budget, max(0.0, CONNECTOR_MAX_BOW_PX - abs(dy)))
    : -min(bend, CONNECTOR_MAX_REACH_PX) / CONNECTOR_APEX_RATIO;
}

// The screen sign of an end's handle: along the read's direction at a trailing
// end, against it at a split junction's leading end, mirrored on a reversed
// region.
public float connectorTangent(float strand, float leading, float reversed) {
  return strand * (leading != 0.0 ? -1.0 : 1.0) * (reversed != 0.0 ? -1.0 : 1.0);
}

// Floored at 1.5 device px, so the single antialiasing ramp has room.
public float connectorStrokePx(float width, float dpr) {
  return max(width, 1.5 / dpr);
}

struct Cubic {
  float2 p0;
  float2 p1;
  float2 p2;
  float2 p3;
};

float2 cubicAt(Cubic c, float t) {
  float s = 1.0 - t;
  return s * s * s * c.p0 + 3.0 * s * s * t * c.p1 + 3.0 * s * t * t * c.p2
    + t * t * t * c.p3;
}

float2 cubicDirection(Cubic c, float t) {
  float s = 1.0 - t;
  float2 d = 3.0 * s * s * (c.p1 - c.p0) + 6.0 * s * t * (c.p2 - c.p1)
    + 3.0 * t * t * (c.p3 - c.p2);
  float len = length(d);
  if (len > 1e-6) { return d / len; }
  float2 chord = c.p3 - c.p0;
  float chordLen = length(chord);
  return chordLen > 1e-6 ? chord / chordLen : float2(1.0, 0.0);
}

float bitSet(uint bits, uint bit) {
  return (bits & bit) != 0u ? 1.0 : 0.0;
}

Cubic placeCubic(ConnectorInstance inst, float4 entry2) {
  Cubic c;
  c.p0 = float2(viewRegionPx(inst.x, u.ownEntry, u.zero),
                u.rowOffsetPx + float(inst.row) * u.rowPitchPx);
  c.p3 = float2(viewRegionPx(inst.x2, entry2, u.zero),
                u.rowOffsetPx + float(inst.row2) * u.rowPitchPx);
  if ((inst.bits & CONNECTOR_STRAIGHT) != 0u) {
    c.p1 = c.p0;
    c.p2 = c.p3;
    return c;
  }
  float2 d = c.p3 - c.p0;
  float budget = connectorBudgetPx(d.x, d.y);
  float handle = connectorHandlePx(budget, u.maxHandlePx);
  float lift = connectorLiftPx(budget, d.y, inst.bend);
  float t1 = connectorTangent(1.0 - 2.0 * bitSet(inst.bits, CONNECTOR_MINUS_1),
                              0.0, u.ownEntry.w < 0.0 ? 1.0 : 0.0);
  float t2 = connectorTangent(1.0 - 2.0 * bitSet(inst.bits, CONNECTOR_MINUS_2),
                              bitSet(inst.bits, CONNECTOR_LEADING_2),
                              entry2.w < 0.0 ? 1.0 : 0.0);
  c.p1 = float2(c.p0.x + handle * t1, c.p0.y - lift);
  c.p2 = float2(c.p3.x + handle * t2, c.p3.y - lift);
  return c;
}

// The curve's length up to segment `seg`, as the strip's chords measure it.
float lengthTo(Cubic c, uint seg) {
  float total = 0.0;
  float2 prev = c.p0;
  for (uint k = 1u; k <= seg; k++) {
    float2 next = cubicAt(c, float(k) / float(CONNECTOR_CURVE_SEGMENTS));
    total += length(next - prev);
    prev = next;
  }
  return total;
}

struct StripVertex {
  float2 screen;
  float across;
  float along;
};

StripVertex curveVertex(Cubic c, uint seg, float side, float hw, bool dashed) {
  float t = float(seg) / float(CONNECTOR_CURVE_SEGMENTS);
  float2 dir = cubicDirection(c, t);
  StripVertex v;
  v.across = side * hw;
  v.screen = cubicAt(c, t) + float2(-dir.y, dir.x) * v.across;
  v.along = dashed ? lengthTo(c, seg) : 0.0;
  return v;
}

// An open arrowhead's arm `a` at the `x2` end, pointing the way the read
// continues: from the tip back and off the row by `arrowPx`.
float2 armEnd(Cubic c, uint a, float strand2, bool reversed2) {
  float back = (reversed2 ? -strand2 : strand2) * -u.arrowPx;
  return c.p3 + float2(back, a == 0u ? -u.arrowPx : u.arrowPx);
}

StripVertex armCorner(Cubic c, uint a, uint corner, float hw, float strand2, bool reversed2) {
  float2 end = armEnd(c, a, strand2, reversed2);
  float2 axis = end - c.p3;
  float len = max(length(axis), 1e-6);
  float2 dir = axis / len;
  StripVertex v;
  v.across = (corner % 2u == 0u) ? -hw : hw;
  v.along = 0.0;
  float at = corner >= 2u ? len : 0.0;
  v.screen = c.p3 + dir * at + float2(-dir.y, dir.x) * v.across;
  return v;
}

[shader("vertex")]
VsOut vs_main(ConnectorInstance inst, uint vid : SV_VertexID) {
  bool placed = inst.x2Region < u.regionCount;
  float4 entry2 = u.regionTable[min(inst.x2Region, VIEW_REGION_MAX - 1u)];
  Cubic c = placeCubic(inst, entry2);
  float halfWidth = 0.5 * connectorStrokePx(inst.width, u.devicePixelRatio);
  float hw = halfWidth + aaHalfPx(u.devicePixelRatio);
  bool dashed = (inst.bits & CONNECTOR_DASHED) != 0u;
  bool arrow = (inst.bits & CONNECTOR_ARROW) != 0u;
  float strand2 = 1.0 - 2.0 * bitSet(inst.bits, CONNECTOR_MINUS_2);
  bool reversed2 = entry2.w < 0.0;

  StripVertex v;
  bool onArm = false;
  if (vid < CURVE_VERTS) {
    v = curveVertex(c, vid / 2u, (vid % 2u == 0u) ? -1.0 : 1.0, hw, dashed);
  } else {
    uint j = vid - CURVE_VERTS;
    uint a = j / ARM_VERTS;
    uint k = j % ARM_VERTS;
    // The block starts from the vertex before it: the curve's last, or the
    // first arm's last corner.
    StripVertex start = a == 0u
      ? curveVertex(c, CONNECTOR_CURVE_SEGMENTS, 1.0, hw, dashed)
      : (arrow ? armCorner(c, 0u, 3u, hw, strand2, reversed2)
               : curveVertex(c, CONNECTOR_CURVE_SEGMENTS, 1.0, hw, dashed));
    if (k == 0u || !arrow) {
      v = start;
    } else {
      v = armCorner(c, a, k <= 2u ? 0u : k - 2u, hw, strand2, reversed2);
      onArm = true;
    }
  }

  VsOut o;
  o.position = placed
    ? float4(v.screen.x / u.canvasWidth * 2.0 - 1.0,
             yPxToClipY(v.screen.y, u.canvasHeight), 0.0, 1.0)
    : float4(-2.0, -2.0, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.across = v.across;
  o.along = v.along;
  o.halfWidthPx = halfWidth;
  o.dashed = dashed && !onArm ? 1.0 : 0.0;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float dash = fragIn.dashed > 0.5 && u.dashPx > 0.0
    ? dashCoverage(fragIn.along, u.dashPx, u.gapPx, u.devicePixelRatio)
    : 1.0;
  float alpha = edgeCoverage(fragIn.halfWidthPx - abs(fragIn.across), u.devicePixelRatio)
    * dash;
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

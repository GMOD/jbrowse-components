// Paired-read arc pass: each instance is a stroked path rendered as a
// triangle-strip that inflates the curve by a half-width on each side;
// fragment shader smooths the edge into AA.
//
// shapeType encodes the curve form:
//   0 = paired arc. A rounded dome while both endpoints fit on screen; once the
//       pair spans more than ARC_FAR_SCREEN_WIDTHS the radius grows so large the
//       band clips the apex away, leaving near-vertical lines rising from each
//       real endpoint. Endpoints always sit at the true bp coordinates.
//   1 = flat horizontal line at Y = destY (samplot paired, solid, alpha 0.25)
//   2 = flat horizontal line at Y = destY (samplot split read, dashed, alpha 0.25)
//
// yBp is the target Y position in genomic bp — for the arc this is the apex
// height; for flat it is the line's Y. Samplot sets yBp = |tlen|; arc mode sets
// yBp = |x2-x1|/2 (the genomic radius).
//! targets: wgsl, glsl
//! export-consts: ARC_HEIGHT_MARGIN, ARC_FAR_SCREEN_WIDTHS, ARC_FLAT_MIN_PX

import alignmentsUniforms;
import colorPack;


// 128 segments: the curve is a triangle-strip polyline, and its facet kinks run
// *along* the stroke where the cross-stroke fwidth AA can't smooth them. Near
// the apex the facets are near-horizontal, so kinks read as flat spots — the
// most visible faceting. Higher tessellation is the only lever (uniform t is
// already equal-arc-length on the circle), and arcs are a low-instance pass.
public static const uint ARC_CURVE_SEGMENTS = 128u;
public static const uint VERTS_PER_INSTANCE = (ARC_CURVE_SEGMENTS + 1u) * 2u;
static const float ARC_HEIGHT_MARGIN = 8.0;
static const float PI = 3.14159265359;
// Once a pair spans more than this many screen widths — i.e. its endpoints no
// longer both fit on screen — a paired arc switches from a band-capped rounded
// dome to a full-size circle (so the band clips it down to near-vertical lines
// at each endpoint). Mirrored in drawCanvas.ts.
static const float ARC_FAR_SCREEN_WIDTHS = 1.0;
// Minimum drawn width (CSS px) of a flat samplot line. Short-insert pairs span
// far less than a pixel, so without a floor the line collapses to an invisible
// zero-length stroke. Mirrored in drawCanvas.ts.
static const float ARC_FLAT_MIN_PX = 2.5;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  x1        : ATTR0;
  uint  x2        : ATTR1;
  float colorType : ATTR2;
  float shapeType : ATTR3;
  uint  yBp       : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float  dist     : COLOR1;
  float  dashed   : COLOR2;
  // Screen x in CSS px (interpolated) — drives the dash pattern. Deliberately
  // NOT fragIn.position.x (physical px), which would halve the dash period on a
  // dpr=2 display and diverge from the Canvas2D setLineDash([3,3]) mirror.
  float  screenPx : COLOR3;
};

// arcColorByIndex is shared from alignmentsUniforms (also used by arcLine).
float3 arcColor(float ct, Uniforms u) {
  uint idx = uint(ct + 0.5);
  if (idx < 9u) { return arcColorByIndex(idx, u); }
  // Gradient fallback for colorType >= NUM_ARC_COLORS.
  return hueRampHalfSat(u.gradientHue);
}

struct ArcPoint { float2 pos; float2 tang; };

// Evaluates position + analytic tangent at t ∈ [0,1] in screen pixels.
// Analytic tangent removes the 3× evalArc calls the finite-difference version
// needed — one call per vertex instead of three.
ArcPoint evalArcPoint(float t, Instance inst, Uniforms u) {
  float x1Norm = bpToLinear(inst.x1, u);
  float x2Norm = bpToLinear(inst.x2, u);
  float availH = u.arcBandH - ARC_HEIGHT_MARGIN;
  float yDir = (u.pairedArcsDown > 0.5) ? 1.0 : -1.0;

  // Y position of the apex (arc) / flat line: availH px maps arcsYDomainBp bp,
  // the CPU-chosen domain (zoom-proportional for arcs, autoscaled |tlen| for
  // samplot). arcBandDestY (alignmentsUniforms) is the shared formula — the same
  // one arcMarker.slang uses so the endpoint squares land on the flat line.
  float destY = arcBandDestY(inst.yBp, availH, u);

  ArcPoint ap;
  if (inst.shapeType > 0.5) {
    // Flat line (samplot): x interpolates from x1 to x2, y is constant at destY.
    // Clamp the span to ARC_FLAT_MIN_PX (centered on the midpoint). The line is
    // horizontal, so its stroke normal is vertical and the span sign is moot.
    float mid = u.blockStartPx + (x1Norm + x2Norm) * 0.5 * u.blockWidth;
    float halfPx = max(abs(x2Norm - x1Norm) * u.blockWidth, ARC_FLAT_MIN_PX) * 0.5;
    ap.pos = float2(mid + (2.0 * t - 1.0) * halfPx, destY * yDir);
    ap.tang = float2(2.0 * halfPx, 0.0);
  } else {
    // Paired arc. `far` is purely a function of on-screen span — no bp limit.
    float cxNorm = (x1Norm + x2Norm) * 0.5;
    float rNorm = (x2Norm - x1Norm) * 0.5;
    float halfWidthPx = abs(rNorm) * u.blockWidth;
    bool far = 2.0 * halfWidthPx > ARC_FAR_SCREEN_WIDTHS * u.canvasW;
    if (far) {
      // True circle (radius == real half-width): so big the band clips the apex
      // and only the near-vertical sides rising from each real endpoint remain.
      float angle = t * PI;
      float xNorm = cxNorm + cos(angle) * rNorm;
      float yPx = sin(angle) * halfWidthPx * yDir;
      ap.pos = float2(u.blockStartPx + xNorm * u.blockWidth, yPx);
      ap.tang = float2(-PI * sin(angle) * rNorm * u.blockWidth,
                       PI * cos(angle) * halfWidthPx * yDir);
    } else {
      // Rounded dome: cubic bezier, control points at x1,x1,x2,x2. x =
      // smoothstep(x1,x2,t), y = 3(1-t)t·destY peaks at t=0.5.
      float mt = 1.0 - t;
      float xNorm = lerp(x1Norm, x2Norm, t*t*(3.0 - 2.0*t));
      float yPx = 3.0 * mt * t * destY * yDir;
      ap.pos = float2(u.blockStartPx + xNorm * u.blockWidth, yPx);
      ap.tang = float2(6.0*(x2Norm-x1Norm)*mt*t * u.blockWidth,
                       3.0*destY*yDir*(1.0 - 2.0*t));
    }
  }
  return ap;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  uint seg = vid / 2u;
  uint sideIdx = vid % 2u;
  float side = (sideIdx == 0u) ? -1.0 : 1.0;
  float t = float(seg) / float(ARC_CURVE_SEGMENTS);

  ArcPoint ap = evalArcPoint(t, inst, u);
  float2 pos = ap.pos;
  float2 tang = ap.tang;
  float tlen = length(tang);
  float2 normal;
  if (tlen > 0.001) {
    float2 tn = tang / tlen;
    normal = float2(-tn.y, tn.x);
  } else {
    normal = float2(0.0, 1.0);
  }

  float lw = u.lineWidthPx;
  float hw = lw * 0.5 + 1.0;
  float2 off = pos + normal * hw * side;
  o.screenPx = off.x;
  float clipX = (off.x / u.canvasW) * 2.0 - 1.0;
  float clipY = 1.0 - ((off.y + u.covOffset) / u.canvasH) * 2.0;
  o.position = float4(flipX(clipX, u), clipY, 0.0, 1.0);
  o.dist = side * hw;
  // Samplot flat shapes (1, 2): the connector line itself is neutral black —
  // the insert-size / orientation color lives in the endpoint squares drawn by
  // the arcMarker pass (mirrors samplot.py's per-read colored markers joined by
  // a plain line). Translucent so dense overlapping pairs read as a band (cf.
  // samplot.py's alpha). Kept well above samplot.py's 0.25 because an isolated
  // short-insert pair is a single thin line — at 0.25-0.4 it all but vanishes
  // into the background; 0.7 keeps an isolated line clearly legible while
  // overlaps still stack darker.
  bool flat = inst.shapeType > 0.5;
  float arcAlpha = flat ? 0.7 : 1.0;
  float3 rgb = flat ? float3(0.0, 0.0, 0.0) : arcColor(inst.colorType, u);
  o.color = float4(rgb, arcAlpha);
  // Split-read flat shape (2) renders dashed.
  o.dashed = (inst.shapeType > 1.5) ? 1.0 : 0.0;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Split-read flat arcs render dashed (samplot.py's dotted style).
  if (fragIn.dashed > 0.5 && frac(fragIn.screenPx / 6.0) > 0.5) { discard; }
  float hw = u.lineWidthPx * 0.5;
  float d = abs(fragIn.dist);
  float aa = fwidth(fragIn.dist);
  float alpha = clamp((hw - d) / aa + 0.5, 0.0, 1.0);
  // Output straight alpha — the HAL blend func does the premultiply.
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

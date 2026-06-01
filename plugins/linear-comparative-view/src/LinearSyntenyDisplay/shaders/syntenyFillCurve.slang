// Linear-synteny fill pass — curved (bezier ribbon) mode.
//
// Geometry: 8 segments × 6 verts = 48 verts/instance. Each segment is a
// trapezoid (TL, TR, BR, BL) hugging the local bezier strip with a small
// perpendicular pad to allow stroke widening for thin features, bezier
// bulge within the segment, and AA fade at boundaries. This keeps the
// rasterized fragment count proportional to ribbon area + boundary AA —
// roughly the same fragment budget as Canvas2D path fill — rather than the
// `corner_bbox × h` overdraw a single-quad bound suffered for slanted
// ribbons.
//
// Fragment: inverts y(t) = h·(1.5t(1-t) + t³) via 2 Newton iterations
// (cubic convergence — sub-pixel accuracy from t₀ = y/h), evaluates the
// two edge x-curves at that t, computes signed perpendicular distance
// from the centerline, and outputs analytic coverage via smoothstep over
// fwidth(perpDist) — geometrically correct AA at any slope.
//
// References:
//   developer.nvidia.com/gpugems/gpugems3 chapter 25 (Loop-Blinn)
//   drewcassidy.me/2020/06/26/sdf-antialiasing/  (SDF AA via fwidth)
//! targets: wgsl, glsl

import colorPack;
import syntenyTypes;

// Tessellation count: 8 segments × 6 verts each. Bezier bulge within one
// segment is bounded by max|s''|·(dt²/8) = 6·(1/8)²/8 ≈ 0.012 in s-units,
// i.e. ~2.3px for a ribbon spanning 200px horizontally — small enough that
// the perpendicular pad bound is dominated by stroke widening rather than
// bezier deviation. Doubling to 16 gives diminishing returns; halving to 4
// makes the bulge term dominate the pad.
public static const uint NUM_SEGMENTS = 8u;
public static const uint VERTS_PER_INSTANCE = NUM_SEGMENTS * 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float featureId : COLOR1;
  // Per-instance bezier corner positions (CSS-pixel screen X for view 0/1).
  // (x1, x2) belong to the top view; (x3, x4) to the bottom.
  nointerpolation float4 corners : COLOR2;
  // Local position within the instance: localPos.x = screen X (CSS px),
  // localPos.y = vertical offset from yTop in CSS px (≈[0, height], slightly
  // extended at the first/last segments for AA fade).
  float2 localPos : COLOR3;
  nointerpolation float isCigar : COLOR4;
};

// Evaluate the centerline / edges at bezier parameter t. `s` is the cubic
// smoothstep X-blend; `y` traces the cubic Hermite ease-in-out.
void evalT(float t, Corners c, out float xL, out float xR, out float y) {
  float s = sBlend(t);
  float edge0 = lerp(c.x1, c.x4, s);
  float edge1 = lerp(c.x2, c.x3, s);
  xL = min(edge0, edge1);
  xR = max(edge0, edge1);
  y = u.height * yCurve(t);
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;
  o.corners = float4(0.0);
  o.localPos = float2(0.0);
  o.isCigar = isCigarKind(inst.kind) ? 1.0 : 0.0;

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.alignmentLength, u)) {
    o.position = float4(0.0);
    return o;
  }
  o.corners = float4(c.x1, c.x2, c.x3, c.x4);

  uint seg = vid / 6u;
  uint vertInSeg = vid % 6u;
  // Vert layout per segment: 0=TL, 1=TR, 2=BL, 3=BL, 4=TR, 5=BR.
  // Triangles (TL, TR, BL) and (BL, TR, BR).
  bool isTop = (vertInSeg == 0u || vertInSeg == 1u || vertInSeg == 4u);
  bool isRight = (vertInSeg == 1u || vertInSeg == 4u || vertInSeg == 5u);

  float invN = 1.0 / float(NUM_SEGMENTS);
  float t = (isTop ? float(seg) : float(seg + 1u)) * invN;

  float xL, xR, y;
  evalT(t, c, xL, xR, y);

  // Perpendicular pad (in horizontal pixels). Accommodates:
  //   (1) thin-feature stroke widening: perpFactor·0.5 (1-px perpendicular
  //       stroke projected onto the x-axis at this slope).
  //   (2) bezier bulge within the segment: max|s''|·dt²/8 in s-units, scaled
  //       by max edge Δ.
  //   (3) AA fade at the boundary: 1 px.
  // The bezier's centerline x'(t) reaches 1.5× the linear chord at t=0.5
  // while y'(t) drops to 0.75×, so local dx/dy peaks at 2× the chord slope.
  //
  // CIGAR tiles skip the AA-fade and stroke-widening pad terms — their polygon
  // edges must coincide exactly with the ribbon edges so adjacent CIGAR
  // polygons (sharing a slanted seam between e.g. M and I) tile via the
  // rasterizer top-left rule with no smoothstep double-fade bleed. bulgeX is
  // still included so the bezier bulge fragments stay inside the polygon.
  float h = max(u.height, 1.0);
  float maxSlope = abs((c.x3 + c.x4 - c.x1 - c.x2) * 0.5) / h * 2.0;
  float maxPerpFactor = sqrt(1.0 + maxSlope * maxSlope);
  float bulgeX = max(abs(c.x4 - c.x1), abs(c.x3 - c.x2)) * invN * invN * 0.75;
  float pad = isCigarKind(inst.kind)
    ? bulgeX
    : maxPerpFactor * 0.5 + bulgeX + 1.0;

  // AA y-pad only at the first segment's top and last segment's bottom; the
  // shared boundaries between adjacent segments must match exactly.
  if (seg == 0u && isTop) { y -= 1.0; }
  if (seg == NUM_SEGMENTS - 1u && !isTop) { y += 1.0; }

  float vx = isRight ? (xR + pad) : (xL - pad);
  o.localPos = float2(vx, y);

  o.position = screenToClip(float2(vx, u.yTop + y), u.resolution);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float yLocal = fragIn.localPos.y;
  float h = max(u.height, 1.0);
  float yFrac = clamp(yLocal / h, 0.0, 1.0);

  // Recover bezier parameter t from the fragment's y position. 2 Newton
  // iterations on the strictly-monotonic y(t) = h·(t³ − 1.5t² + 1.5t)
  // converge to sub-pixel accuracy from t₀ = yFrac (f' ≥ 0.75 on [0,1]).
  float t = yFrac;
  for (int i = 0; i < 2; i++) {
    t = t - (yCurve(t) - yFrac) / yCurveDeriv(t);
  }
  t = clamp(t, 0.0, 1.0);
  float s = sBlend(t);

  float edge0 = lerp(fragIn.corners.x, fragIn.corners.w, s);
  float edge1 = lerp(fragIn.corners.y, fragIn.corners.z, s);
  float xL = min(edge0, edge1);
  float xR = max(edge0, edge1);

  // Local centerline slope dx/dy at this t from analytic bezier derivatives.
  float topMid = (fragIn.corners.x + fragIn.corners.y) * 0.5;
  float botMid = (fragIn.corners.z + fragIn.corners.w) * 0.5;
  float dxdt = (botMid - topMid) * sBlendDeriv(t);
  float dydt = h * yCurveDeriv(t);
  float slope = dxdt / max(abs(dydt), 1e-4);
  float perpFactor = sqrt(1.0 + slope * slope);

  float coverage = fillCoverage(fragIn.localPos, xL, xR, perpFactor,
                                fragIn.isCigar, h);
  if (coverage <= 0.0) { discard; }
  return shadeFill(fragIn.color, fragIn.featureId, coverage, u);
}

// Linear-synteny fill pass — hybrid: 8 tight sloped quads tessellating the
// bezier strip, with per-fragment bezier evaluation for pixel-perfect curves
// and SDF antialiasing.
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
public static const uint VERTS_PER_INSTANCE = 8u * 6u;
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
};

// Evaluate the centerline / edges at parameter t. `s` is the X-blend (cubic
// smoothstep for curves, linear for parallelograms). `y` is the y-position.
void evalT(float t, Corners c, out float xL, out float xR, out float y) {
  float s = u.isCurve > 0.5 ? (t * t * (3.0 - 2.0 * t)) : t;
  float edge0 = lerp(c.x1, c.x4, s);
  float edge1 = lerp(c.x2, c.x3, s);
  xL = min(edge0, edge1);
  xR = max(edge0, edge1);
  y = u.isCurve > 0.5
    ? u.height * (1.5 * t * (1.0 - t) + t * t * t)
    : u.height * t;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;
  o.corners = float4(0.0);
  o.localPos = float2(0.0);

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.queryTotalLength, u)) {
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

  // Perpendicular pad (in horizontal pixels). Must accommodate three things:
  //   (1) thin-feature stroke widening: perpFactor·0.5 (1-px perpendicular
  //       stroke projected onto the x-axis at this slope).
  //   (2) bezier bulge within the segment in curve mode: max|s''|·dt²/8 ≈
  //       0.75·dt² in s-units, scaled by max edge Δ.
  //   (3) AA fade at the boundary: 1 px.
  // The bezier's centerline x'(t) reaches 1.5× the linear chord at t=0.5
  // while y'(t) drops to 0.75×, so local dx/dy peaks at 2× the chord slope —
  // use that as the conservative perpFactor for the whole instance.
  float h = max(u.height, 1.0);
  float linearSlope = abs((c.x3 + c.x4 - c.x1 - c.x2) * 0.5) / h;
  float maxSlope = u.isCurve > 0.5 ? linearSlope * 2.0 : linearSlope;
  float maxPerpFactor = sqrt(1.0 + maxSlope * maxSlope);
  float bulgeX = u.isCurve > 0.5
    ? max(abs(c.x4 - c.x1), abs(c.x3 - c.x2)) * invN * invN * 0.75
    : 0.0;
  float pad = maxPerpFactor * 0.5 + bulgeX + 1.0;

  // AA y-pad only at the first segment's top and last segment's bottom; the
  // shared boundaries between adjacent segments must match exactly.
  if (seg == 0u && isTop) { y -= 1.0; }
  if (seg == NUM_SEGMENTS - 1u && !isTop) { y += 1.0; }

  float vx = isRight ? (xR + pad) : (xL - pad);
  o.localPos = float2(vx, y);

  float2 screen = float2(vx, u.yTop + y);
  float2 clipSpace = screen / u.resolution * 2.0 - 1.0;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float yLocal = fragIn.localPos.y;
  float h = max(u.height, 1.0);
  float yFrac = clamp(yLocal / h, 0.0, 1.0);

  // Recover bezier parameter t from the fragment's y position. Curve mode:
  // 2 Newton iterations on the strictly-monotonic y(t) = h·(t³ − 1.5t² + 1.5t)
  // converge to sub-pixel accuracy from t₀ = yFrac (f' ≥ 0.375 on [0,1]).
  // Linear mode: t = yFrac directly.
  float t = yFrac;
  if (u.isCurve > 0.5) {
    for (int i = 0; i < 2; i++) {
      float ft  = t * (1.5 + t * (t - 1.5)) - yFrac;
      float fpt = 1.5 + t * (3.0 * t - 3.0);
      t = t - ft / fpt;
    }
    t = clamp(t, 0.0, 1.0);
  }
  float s = u.isCurve > 0.5 ? (t * t * (3.0 - 2.0 * t)) : t;

  // Two edge x's at this t. Min/max handles forward + crossed/inverted
  // (bowtie) ribbons uniformly.
  float edge0 = lerp(fragIn.corners.x, fragIn.corners.w, s);  // c.x1 → c.x4
  float edge1 = lerp(fragIn.corners.y, fragIn.corners.z, s);  // c.x2 → c.x3
  float xL = min(edge0, edge1);
  float xR = max(edge0, edge1);
  float xC = (xL + xR) * 0.5;

  // Local centerline slope dx/dy at this t from analytic bezier derivatives.
  float topMid = (fragIn.corners.x + fragIn.corners.y) * 0.5;
  float botMid = (fragIn.corners.z + fragIn.corners.w) * 0.5;
  float dxdt, dydt;
  if (u.isCurve > 0.5) {
    dxdt = (botMid - topMid) * 6.0 * t * (1.0 - t);
    dydt = h * (1.5 - 3.0 * t + 3.0 * t * t);
  } else {
    dxdt = botMid - topMid;
    dydt = h;
  }
  float slope = dxdt / max(abs(dydt), 1e-4);
  float perpFactor = sqrt(1.0 + slope * slope);

  // SDF-based coverage: perpDist is signed perpendicular distance from the
  // centerline; ribbon spans |perpDist| ≤ halfPerpW. AA over 1 screen pixel
  // of perpDist movement via fwidth(perpDist), giving geometrically-correct
  // coverage at any slope (including near-horizontal strokes that would
  // otherwise sub-pixel-beat into dashes with per-x-axis AA).
  //
  // For thin features (origin/main's `l1 ≤ 1 && l2 ≤ 1` stroke branch),
  // clamp halfPerpW to 0.5 so the rendered perpendicular width is at least
  // 1 px regardless of true feature size.
  float x = fragIn.localPos.x;
  float perpDist = (x - xC) / perpFactor;
  float halfPerpW = max((xR - xL) / (2.0 * perpFactor), 0.5);
  float aaPerp = max(fwidth(perpDist), 1e-4);
  float cx = 1.0 - smoothstep(halfPerpW - aaPerp * 0.5,
                              halfPerpW + aaPerp * 0.5,
                              abs(perpDist));
  // Vertical AA at top/bottom of the track.
  float ay = max(fwidth(yLocal), 1e-4) * 0.5;
  float cy = smoothstep(-ay, ay, yLocal)
           - smoothstep(h - ay, h + ay, yLocal);
  float coverage = cx * cy;
  if (coverage <= 0.0) { discard; }

  float3 rgb = fragIn.color.rgb;
  // SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
  // Canvas2DSyntenyRenderer.ts's hover branch.
  bool isHovered = u.hoveredFeatureId > 0.0 && abs(fragIn.featureId - u.hoveredFeatureId) < 0.5;
  float baseAlpha = fragIn.color.a * u.alpha;
  rgb *= isHovered ? 0.7 : 1.0;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  return float4(rgb, finalAlpha * coverage);
}

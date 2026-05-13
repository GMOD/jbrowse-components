// Linear-synteny fill pass — per-fragment bezier evaluation.
//
// Each instance emits one bounding quad (6 verts). The fragment shader
// recovers the bezier parameter `t` for its screen-y position by inverting
// the monotonic cubic y(t) = h·(1.5t(1-t) + t³) via 3 Newton iterations
// (cubic convergence — ~10⁻⁹ accuracy from t₀ = y/h). It then evaluates the
// two edge x-curves at that t and computes analytic per-pixel coverage with
// smoothstep AA, giving mathematically perfect curves at any zoom (no
// tessellation chunkiness, no segment-count tradeoff). 96 → 6 verts/instance.
//
// References:
//   developer.nvidia.com/gpugems/gpugems3 chapter 25 (Loop-Blinn)
//   vladjuckov.github.io/beziers-sdf/ (per-fragment SDF approach)
//! targets: wgsl, glsl

import colorPack;
import syntenyTypes;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float featureId : COLOR1;
  // Per-instance bezier corner positions (CSS-pixel screen X for view 0/1).
  // (x1, x2) belong to the top view; (x3, x4) to the bottom.
  nointerpolation float4 corners : COLOR2;
  // Local position within the instance: localPos.x = screen X (CSS px),
  // localPos.y = vertical offset from yTop in CSS px, in [0, height]
  // (slightly extended by AA padding at the boundaries).
  float2 localPos : COLOR3;
};

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

  // Tight bounding quad in instance-local coordinates. Expanded ±1px on all
  // sides so the smoothstep AA in the fragment shader has room to fade.
  float xMin = min(min(c.x1, c.x2), min(c.x3, c.x4)) - 1.0;
  float xMax = max(max(c.x1, c.x2), max(c.x3, c.x4)) + 1.0;
  float yMin = -1.0;
  float yMax = u.height + 1.0;

  // 6 verts → 2 triangles: (TL, TR, BL) (BL, TR, BR).
  float2 q;
  switch (vid) {
    case 0u: { q = float2(xMin, yMin); break; }
    case 1u: { q = float2(xMax, yMin); break; }
    case 2u: { q = float2(xMin, yMax); break; }
    case 3u: { q = float2(xMin, yMax); break; }
    case 4u: { q = float2(xMax, yMin); break; }
    case 5u: { q = float2(xMax, yMax); break; }
    default: { q = float2(0.0); break; }
  }
  o.localPos = q;
  float2 screen = float2(q.x, u.yTop + q.y);
  float2 clipSpace = screen / u.resolution * 2.0 - 1.0;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float yLocal = fragIn.localPos.y;
  float h = max(u.height, 1.0);
  float yFrac = clamp(yLocal / h, 0.0, 1.0);

  // Curve mode: invert y(t) = h·(t³ − 1.5t² + 1.5t) for t via Newton.
  // f(t) is strictly monotonic on [0,1] (f'(t) = 3t² − 3t + 1.5 ≥ 0.375),
  // so 3 iterations from t₀ = yFrac converge to sub-ULP accuracy.
  // Linear mode: y(t) = h·t, so t = yFrac directly.
  float t = yFrac;
  if (u.isCurve > 0.5) {
    for (int i = 0; i < 3; i++) {
      float ft  = t * (1.5 + t * (t - 1.5)) - yFrac;  // t³ − 1.5t² + 1.5t − yFrac
      float fpt = 1.5 + t * (3.0 * t - 3.0);          // 3t² − 3t + 1.5
      t = t - ft / fpt;
    }
    t = clamp(t, 0.0, 1.0);
  }
  // X-blend along the curve: smoothstep cubic in curve mode, linear otherwise.
  float s = u.isCurve > 0.5 ? (t * t * (3.0 - 2.0 * t)) : t;

  // Two edge x's at this t. Min/max handles forward and crossed/inverted
  // (bowtie) ribbons uniformly.
  float edge0 = lerp(fragIn.corners.x, fragIn.corners.w, s);  // c.x1 → c.x4
  float edge1 = lerp(fragIn.corners.y, fragIn.corners.z, s);  // c.x2 → c.x3
  float xL = min(edge0, edge1);
  float xR = max(edge0, edge1);

  float x  = fragIn.localPos.x;
  float ax = max(fwidth(x), 1e-4) * 0.5;
  float ay = max(fwidth(yLocal), 1e-4) * 0.5;
  // Horizontal coverage: smoothstep into the ribbon from the left edge and
  // back out at the right. For a sub-pixel-wide ribbon the two smoothsteps
  // overlap and the product yields coverage proportional to the true width
  // (energy-conserving — matches Canvas2D path AA).
  float cx = smoothstep(xL - ax, xL + ax, x) - smoothstep(xR - ax, xR + ax, x);
  // Vertical coverage: fade at top/bottom track edges.
  float cy = smoothstep(-ay, ay, yLocal)
           - smoothstep(h - ay, h + ay, yLocal);
  float coverage = cx * cy;
  if (coverage <= 0.0) { discard; }

  float3 rgb = fragIn.color.rgb;
  // SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
  // Canvas2DSyntenyRenderer.ts's hover branch so the highlight looks
  // identical across all backends.
  bool isHovered = u.hoveredFeatureId > 0.0 && abs(fragIn.featureId - u.hoveredFeatureId) < 0.5;
  float baseAlpha = fragIn.color.a * u.alpha;
  rgb *= isHovered ? 0.7 : 1.0;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  return float4(rgb, finalAlpha * coverage);
}

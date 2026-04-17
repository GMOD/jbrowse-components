// Linear-synteny fill pass. Each instance is a parallelogram (or Hermite-
// curve quad) between two assemblies; we tessellate into FILL_SEGS pieces
// along t so the curve stays smooth, and deal with inversion-pinch crossings
// by tessellating unevenly around the crossing point.
//! targets: wgsl, glsl

import syntenyTypes;

static const uint FILL_SEGS = 16u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float featureId : COLOR1;
};

float3 hermiteEdges(float sX1, float sX2, float sX3, float sX4, float t, float isCurve, Uniforms u) {
  float edge0, edge1, y;
  if (isCurve > 0.5) {
    float s = t * t * (3.0 - 2.0 * t);
    edge0 = lerp(sX1, sX4, s);
    edge1 = lerp(sX2, sX3, s);
    y = u.yTop + u.height * (1.5 * t * (1.0 - t) + t * t * t);
  } else {
    edge0 = lerp(sX1, sX4, t);
    edge1 = lerp(sX2, sX3, t);
    y = u.yTop + t * u.height;
  }
  return float3(edge0, edge1, y);
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.queryTotalLength, u)) {
    o.position = float4(0.0);
    return o;
  }

  uint seg = vid / 6u;
  uint vertInSeg = vid % 6u;
  float topDiff = c.x1 - c.x2;
  float botDiff = c.x4 - c.x3;

  float t0, t1;
  if (topDiff * botDiff < 0.0) {
    float tCross = clamp(topDiff / (topDiff - botDiff), 0.01, 0.99);
    uint nUpper = clamp(uint(round(float(FILL_SEGS) * tCross)), 1u, FILL_SEGS - 1u);
    if (seg < nUpper) {
      t0 = float(seg) / float(nUpper) * tCross;
      t1 = float(seg + 1u) / float(nUpper) * tCross;
    } else {
      uint lSeg = seg - nUpper;
      uint nLower = FILL_SEGS - nUpper;
      t0 = tCross + float(lSeg) / float(nLower) * (1.0 - tCross);
      t1 = tCross + float(lSeg + 1u) / float(nLower) * (1.0 - tCross);
    }
  } else {
    t0 = float(seg) / float(FILL_SEGS);
    t1 = float(seg + 1u) / float(FILL_SEGS);
  }

  float t, side;
  switch (vertInSeg) {
    case 0u: { t = t0; side = 0.0; break; }
    case 1u: { t = t0; side = 1.0; break; }
    case 2u: { t = t1; side = 0.0; break; }
    case 3u: { t = t1; side = 0.0; break; }
    case 4u: { t = t0; side = 1.0; break; }
    case 5u: { t = t1; side = 1.0; break; }
    default: { t = 0.0; side = 0.0; break; }
  }

  float3 e = hermiteEdges(c.x1, c.x2, c.x3, c.x4, t, inst.isCurve, u);
  float edgeX = side > 0.5 ? e.y : e.x;
  float2 clipSpace = float2(edgeX, e.z) / u.resolution * 2.0 - 1.0;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float3 rgb = fragIn.color.rgb;
  bool isHovered = u.hoveredFeatureId > 0.0 && abs(fragIn.featureId - u.hoveredFeatureId) < 0.5;
  float baseAlpha = fragIn.color.a * u.alpha;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  if (isHovered) {
    rgb = rgb * 0.7;
  }
  return float4(rgb, finalAlpha);
}

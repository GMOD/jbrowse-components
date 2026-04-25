// Dotplot line segment renderer. Each instance is a line from (x1,y1) to
// (x2,y2) in bp space; the shader projects bp → screen pixel using per-region
// offset uniforms + hpmath, then expands the segment into a screen-space quad
// of thickness `lineWidth` pixels with smoothstep-based edge antialiasing.
//
// Coordinate convention (post bp-coordinate refactor): x*/y* are bp-offset
// within the corner's xRegionIdx/yRegionIdx-th displayedRegion. The shader
// projects via `regionOffsetH/V[idx] + bp / bpPerPx` with hpmath so deep-zoom
// precision holds past 32-bit float.
//
// Colors are pre-packed ABGR u32 on the CPU side
// (dotplotWebGLColors.ts#packColor). Blend uses premultiplied alpha
// (one / one-minus-src-alpha).
//! targets: wgsl, glsl

import hpmath;

static const uint VERTICES_PER_INSTANCE = 6u;

float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}

struct DotplotInstance {
  uint  x1          : ATTR0;
  uint  y1          : ATTR1;
  uint  x2          : ATTR2;
  uint  y2          : ATTR3;
  uint  xRegionIdx  : ATTR4;
  uint  yRegionIdx  : ATTR5;
  uint  color       : ATTR6;
};

// MAX_REGIONS = 16. If a view has more than that we fall back to per-region
// draw calls (not yet wired — warn + clamp for now).
struct Uniforms {
  float2 resolution;
  float  lineWidth;
  float  bpPerPxH;
  float  bpPerPxV;
  float  hpZero;
  // regionOffsetH[0..15] = screen pixel where bp=0 of hview.displayedRegions[i] lands
  float  regionOffsetH0;
  float  regionOffsetH1;
  float  regionOffsetH2;
  float  regionOffsetH3;
  float  regionOffsetH4;
  float  regionOffsetH5;
  float  regionOffsetH6;
  float  regionOffsetH7;
  float  regionOffsetH8;
  float  regionOffsetH9;
  float  regionOffsetH10;
  float  regionOffsetH11;
  float  regionOffsetH12;
  float  regionOffsetH13;
  float  regionOffsetH14;
  float  regionOffsetH15;
  // regionOffsetV[0..15] = same, for vview
  float  regionOffsetV0;
  float  regionOffsetV1;
  float  regionOffsetV2;
  float  regionOffsetV3;
  float  regionOffsetV4;
  float  regionOffsetV5;
  float  regionOffsetV6;
  float  regionOffsetV7;
  float  regionOffsetV8;
  float  regionOffsetV9;
  float  regionOffsetV10;
  float  regionOffsetV11;
  float  regionOffsetV12;
  float  regionOffsetV13;
  float  regionOffsetV14;
  float  regionOffsetV15;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float regionOffsetH(uint idx) {
  switch (idx) {
    case 0u:  return u.regionOffsetH0;
    case 1u:  return u.regionOffsetH1;
    case 2u:  return u.regionOffsetH2;
    case 3u:  return u.regionOffsetH3;
    case 4u:  return u.regionOffsetH4;
    case 5u:  return u.regionOffsetH5;
    case 6u:  return u.regionOffsetH6;
    case 7u:  return u.regionOffsetH7;
    case 8u:  return u.regionOffsetH8;
    case 9u:  return u.regionOffsetH9;
    case 10u: return u.regionOffsetH10;
    case 11u: return u.regionOffsetH11;
    case 12u: return u.regionOffsetH12;
    case 13u: return u.regionOffsetH13;
    case 14u: return u.regionOffsetH14;
    case 15u: return u.regionOffsetH15;
    default:  return 0.0;
  }
}

float regionOffsetV(uint idx) {
  switch (idx) {
    case 0u:  return u.regionOffsetV0;
    case 1u:  return u.regionOffsetV1;
    case 2u:  return u.regionOffsetV2;
    case 3u:  return u.regionOffsetV3;
    case 4u:  return u.regionOffsetV4;
    case 5u:  return u.regionOffsetV5;
    case 6u:  return u.regionOffsetV6;
    case 7u:  return u.regionOffsetV7;
    case 8u:  return u.regionOffsetV8;
    case 9u:  return u.regionOffsetV9;
    case 10u: return u.regionOffsetV10;
    case 11u: return u.regionOffsetV11;
    case 12u: return u.regionOffsetV12;
    case 13u: return u.regionOffsetV13;
    case 14u: return u.regionOffsetV14;
    case 15u: return u.regionOffsetV15;
    default:  return 0.0;
  }
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float  edge     : COLOR1;
};

[shader("vertex")]
VsOut vs_main(DotplotInstance inst, uint vid : SV_VertexID) {
  uint v = vid % VERTICES_PER_INSTANCE;

  // Quad template: pairs (0,1), (2,3), (4,5) form two triangles that cover
  // the thickened line. `t` interpolates along the segment, `side` pushes
  // the vertex to one side of the segment by lineWidth/2.
  // v : 0   1   2   3   4   5
  // t : 0   0   1   1   0   1
  // s :-1  +1  -1  -1  +1  +1
  float t = (v == 2u || v == 3u || v == 5u) ? 1.0 : 0.0;
  float side = (v == 1u || v == 4u || v == 5u) ? 1.0 : -1.0;

  float3 bpRangeH = float3(0.0, 0.0, u.bpPerPxH);
  float3 bpRangeV = float3(0.0, 0.0, u.bpPerPxV);
  float xBase = regionOffsetH(inst.xRegionIdx);
  float yBase = regionOffsetV(inst.yRegionIdx);

  float sx1 = xBase + hpScaleLinear(hpSplitUint(inst.x1), bpRangeH, u.hpZero);
  float sy1 = u.resolution.y - (yBase + hpScaleLinear(hpSplitUint(inst.y1), bpRangeV, u.hpZero));
  float sx2 = xBase + hpScaleLinear(hpSplitUint(inst.x2), bpRangeH, u.hpZero);
  float sy2 = u.resolution.y - (yBase + hpScaleLinear(hpSplitUint(inst.y2), bpRangeV, u.hpZero));

  float x = lerp(sx1, sx2, t);
  float y = lerp(sy1, sy2, t);

  float dx = sx2 - sx1;
  float dy = sy2 - sy1;
  float len = sqrt(dx * dx + dy * dy);
  float2 normal;
  if (len > 0.001) {
    normal = float2(-dy, dx) / len;
  } else {
    normal = float2(0.0, 1.0);
  }

  float2 pos = float2(x, y) + normal * side * u.lineWidth * 0.5;
  float2 clipSpace = (pos / u.resolution) * 2.0 - 1.0;

  VsOut o;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.edge = side;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float d = abs(fragIn.edge);
  float aa = fwidth(fragIn.edge);
  float edgeAlpha = 1.0 - smoothstep(0.5 - aa * 0.5, 0.5 + aa, d);
  float finalAlpha = fragIn.color.a * edgeAlpha;
  return float4(fragIn.color.rgb * finalAlpha, finalAlpha);
}

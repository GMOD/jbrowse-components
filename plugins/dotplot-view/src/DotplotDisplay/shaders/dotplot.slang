

public static const uint VERTS_PER_INSTANCE = 6u;
// Dotplot line segment renderer. Each instance is a line from (x1,y1) to
// (x2,y2) in cumulative-bp space; the shader converts to screen pixels using
// hp-math (hi/lo split for precision at T2T scale) and expands the line into
// a screen-space quad with rounded caps, matching Canvas2D's lineCap:'round'
// behavior. The quad is extended by lineWidth/2 along the segment tangent at
// each end and a capsule SDF in the fragment shader produces circular caps
// so short alignments render as dots that grow isotropically with lineWidth.
//
// Colors are pre-packed ABGR u32 on the CPU side
// (dotplotColors.ts#packColor). Blend uses premultiplied alpha
// (one / one-minus-src-alpha).
//! targets: wgsl, glsl

import hpmath;
import colorPack;

struct DotplotInstance {
  float x1Hi : ATTR0;
  float x1Lo : ATTR1;
  float y1Hi : ATTR2;
  float y1Lo : ATTR3;
  float x2Hi : ATTR4;
  float x2Lo : ATTR5;
  float y2Hi : ATTR6;
  float y2Lo : ATTR7;
  uint  color : ATTR8;
};

struct Uniforms {
  float2 resolution;
  float  lineWidth;
  float  viewBpHHi;
  float  viewBpHLo;
  float  bpPerPxHInv;
  float  viewBpVHi;
  float  viewBpVLo;
  float  bpPerPxVInv;
  float  hpZero;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // uv.x: signed distance along the segment in screen px (0 at start, segLen
  //   at end; the cap quad extends to -halfWidth and segLen+halfWidth).
  // uv.y: signed perpendicular distance in screen px (±halfWidth at quad edges).
  float2 uv       : COLOR1;
  // x = segLen (screen px), y = halfWidth (screen px). Constant per instance.
  nointerpolation float2 dims : COLOR2;
};

[shader("vertex")]
VsOut vs_main(DotplotInstance inst, uint vid : SV_VertexID) {
  uint v = vid % VERTS_PER_INSTANCE;

  // Quad template: pairs (0,1), (2,3), (4,5) form two triangles.
  // t interpolates along the segment, side pushes to one edge by halfWidth.
  float t = (v == 2u || v == 3u || v == 5u) ? 1.0 : 0.0;
  float side = (v == 1u || v == 4u || v == 5u) ? 1.0 : -1.0;

  float sx1 = hpCornerScreenX(inst.x1Hi, inst.x1Lo, u.viewBpHHi, u.viewBpHLo, u.bpPerPxHInv, u.hpZero);
  float sy1 = u.resolution.y - hpCornerScreenX(inst.y1Hi, inst.y1Lo, u.viewBpVHi, u.viewBpVLo, u.bpPerPxVInv, u.hpZero);
  float sx2 = hpCornerScreenX(inst.x2Hi, inst.x2Lo, u.viewBpHHi, u.viewBpHLo, u.bpPerPxHInv, u.hpZero);
  float sy2 = u.resolution.y - hpCornerScreenX(inst.y2Hi, inst.y2Lo, u.viewBpVHi, u.viewBpVLo, u.bpPerPxVInv, u.hpZero);

  float dx = sx2 - sx1;
  float dy = sy2 - sy1;
  float len = sqrt(dx * dx + dy * dy);
  float halfWidth = u.lineWidth * 0.5;

  float2 tangent;
  float2 normal;
  if (len > 0.001) {
    tangent = float2(dx, dy) / len;
    normal = float2(-dy, dx) / len;
  } else {
    tangent = float2(1.0, 0.0);
    normal = float2(0.0, 1.0);
  }

  // Extend quad by halfWidth along the tangent at each end so the rounded
  // caps have geometry to shade.
  float capDir = t * 2.0 - 1.0;
  float2 center = lerp(float2(sx1, sy1), float2(sx2, sy2), t);
  float2 pos = center + tangent * capDir * halfWidth + normal * side * halfWidth;
  float2 clipSpace = (pos / u.resolution) * 2.0 - 1.0;

  VsOut o;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.uv = float2(t * len + capDir * halfWidth, side * halfWidth);
  o.dims = float2(len, halfWidth);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Capsule SDF: distance from the fragment to the segment {(0,0)..(segLen,0)}.
  // For very short segments (segLen << halfWidth) this collapses to the
  // distance from origin, producing a circular dot of radius halfWidth.
  float segLen = fragIn.dims.x;
  float halfWidth = fragIn.dims.y;
  float cx = clamp(fragIn.uv.x, 0.0, segLen);
  float du = fragIn.uv.x - cx;
  float dv = fragIn.uv.y;
  float d = sqrt(du * du + dv * dv);
  float aa = fwidth(d);
  float edgeAlpha = 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, d);
  float finalAlpha = fragIn.color.a * edgeAlpha;
  return float4(fragIn.color.rgb * finalAlpha, finalAlpha);
}

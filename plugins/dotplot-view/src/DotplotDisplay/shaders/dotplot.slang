

public static const uint VERTS_PER_INSTANCE = 6u;
// Dotplot line segment renderer. Each instance is a line from (x1,y1) to
// (x2,y2) in cumulative-bp space; the shader converts to screen pixels using
// hp-math (hi/lo split for precision at T2T scale) and expands the line into
// a screen-space quad of thickness `lineWidth` pixels with smoothstep-based
// edge antialiasing.
//
// Colors are pre-packed ABGR u32 on the CPU side
// (dotplotWebGLColors.ts#packColor). Blend uses premultiplied alpha
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
  float padH  : ATTR8;
  float padV  : ATTR9;
  uint  color : ATTR10;
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
  float  edge     : COLOR1;
};

[shader("vertex")]
VsOut vs_main(DotplotInstance inst, uint vid : SV_VertexID) {
  uint v = vid % VERTS_PER_INSTANCE;

  // Quad template: pairs (0,1), (2,3), (4,5) form two triangles.
  // t interpolates along the segment, side pushes to one edge by lineWidth/2.
  float t = (v == 2u || v == 3u || v == 5u) ? 1.0 : 0.0;
  float side = (v == 1u || v == 4u || v == 5u) ? 1.0 : -1.0;

  float sx1 = hpCornerScreenX(inst.x1Hi, inst.x1Lo, u.viewBpHHi, u.viewBpHLo, u.bpPerPxHInv, inst.padH, u.hpZero);
  float sy1 = u.resolution.y - hpCornerScreenX(inst.y1Hi, inst.y1Lo, u.viewBpVHi, u.viewBpVLo, u.bpPerPxVInv, inst.padV, u.hpZero);
  float sx2 = hpCornerScreenX(inst.x2Hi, inst.x2Lo, u.viewBpHHi, u.viewBpHLo, u.bpPerPxHInv, inst.padH, u.hpZero);
  float sy2 = u.resolution.y - hpCornerScreenX(inst.y2Hi, inst.y2Lo, u.viewBpVHi, u.viewBpVLo, u.bpPerPxVInv, inst.padV, u.hpZero);

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

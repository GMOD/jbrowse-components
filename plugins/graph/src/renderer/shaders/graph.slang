// Graph genome renderer. Draws pre-built indexed triangle geometry (edges,
// nodes, arrows) in a shared CPU-space coordinate system. The vertex shader
// expands each vertex along its surface normal by a per-vertex thickness
// (in CSS pixels) so thin edges stay visible at any zoom level. Color is
// packed ABGR-in-u32 (see packAbgr in colorBits.ts) to keep the per-vertex
// stride small.
//! targets: wgsl, glsl

import colorPack;

struct GraphVertex {
  float2 position  : ATTR0;
  float2 normal    : ATTR1;
  float  thickness : ATTR2;
  uint   color     : ATTR3;
};

struct Uniforms {
  float2 scale;
  float2 translate;
  float2 viewport;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(GraphVertex v) {
  float2 expanded = v.position + v.normal * v.thickness / u.scale.x;
  float2 screen = expanded * u.scale + u.translate;
  float2 clip = (screen / u.viewport) * 2.0 - 1.0;
  VsOut o;
  o.position = float4(clip.x, -clip.y, 0.0, 1.0);
  o.color = unpackRGBA(v.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

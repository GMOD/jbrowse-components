// Indicator pass: a single 7x4.5px triangle per instance pinned to the top
// of the coverage area. Barycentric coords in the fragment shader give
// cheap diagonal-edge anti-aliasing.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/indicatorLayout.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;

// SYNC(@jbrowse/alignments-core labelConstants.ts)
static const float TRIANGLE_HW = 3.5;
static const float TRIANGLE_H  = 4.5;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float colorType : ATTR1;  // 1=insertion 2=softclip 3=hardclip
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float3 bary     : COLOR1;
};

float3 indicatorColor(float ct, Uniforms u) {
  int ci = int(ct);
  if (ci == 1) { return unpackRGBA(u.colorInsertion).xyz; }
  if (ci == 2) { return unpackRGBA(u.colorSoftclip).xyz; }
  return unpackRGBA(u.colorHardclip).xyz;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  uint v = vid % 3u;

  float cx = hpClipX(hpSplitUint(inst.position), u);
  float tw = TRIANGLE_HW * 2.0 * 2.0 / u.canvasW;  // full triangle width in clip-x
  float th = TRIANGLE_H * 2.0 / u.canvasH;

  float sx, sy;
  if (v == 0u)      { sx = cx - tw * 0.5; sy = 1.0;      o.bary = float3(1.0, 0.0, 0.0); }
  else if (v == 1u) { sx = cx + tw * 0.5; sy = 1.0;      o.bary = float3(0.0, 1.0, 0.0); }
  else              { sx = cx;            sy = 1.0 - th; o.bary = float3(0.0, 0.0, 1.0); }

  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  o.color = float4(indicatorColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // 7x4.5 triangle altitude ~3.7px -> smoothstep along diagonal edges.
  float altPx = 3.7;
  float dLeft = fragIn.bary.y * altPx;
  float dRight = fragIn.bary.x * altPx;
  float aa = smoothstep(0.0, 1.0, min(dLeft, dRight));
  return float4(fragIn.color.rgb, fragIn.color.a * aa);
}

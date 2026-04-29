// Arc-line pass: 2 verts per instance, drawn as line-list. Vertical lines
// connecting a bp position to its arc endpoint.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 2u;
static const uint NUM_LINE_COLORS = 2u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float y         : ATTR1;
  float colorType : ATTR2;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float3 arcLineColorByIndex(uint idx, Uniforms u) {
  if (idx == 0u) { return unpackRGBA(u.arcLineColor0).xyz; }
  return unpackRGBA(u.arcLineColor1).xyz;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  uint v = vid % 2u;

  float norm = hpLinear(hpSplitUint(inst.position), u);
  float screenX = u.blockStartPx + norm * u.blockWidth;
  float sx = (screenX / u.canvasW) * 2.0 - 1.0;

  float yOff = (u.pairedArcsDown > 0.5)
    ? inst.y
    : (u.canvasH - u.covOffset - inst.y);
  float sy = (v == 0u)
    ? 1.0 - ((yOff + u.covOffset) / u.canvasH) * 2.0
    : 1.0 - (u.covOffset / u.canvasH) * 2.0;

  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  uint idx = uint(inst.colorType + 0.5);
  uint ci = min(idx, NUM_LINE_COLORS - 1u);
  o.color = float4(arcLineColorByIndex(ci, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

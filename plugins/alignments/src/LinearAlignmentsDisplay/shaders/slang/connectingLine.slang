// Linked-read connecting line: a 1px horizontal black line between each
// pair of mates in a chain. Snaps Y to nearest pixel for a crisp 1px stroke.
//! targets: wgsl, glsl

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  startOff : ATTR0;
  uint  endOff   : ATTR1;
  float y        : ATTR2;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float sx1 = bpToClipX(inst.startOff, u);
  float sx2 = bpToClipX(inst.endOff, u);

  float yTop = floor(pileupRowCenterPx(inst.y, u) - 0.5);
  float yBot = yTop + 1.0;
  float px2clip = 2.0 / u.canvasH;
  float syTop = 1.0 - yTop * px2clip;
  float syBot = 1.0 - yBot * px2clip;

  o.position = flippedQuadPos(sx1, sx2, syBot, syTop, local, u);
  o.color = float4(0.0, 0.0, 0.0, 0.45);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}

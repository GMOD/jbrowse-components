// One 1bp-wide pileup quad per instance, colored by a per-instance ABGR u32
// packed on the main thread. Shared by two passes that are byte-for-byte the
// same draw:
//   - modification    (features/modification/packGpu.ts)
//   - perBaseQuality  (features/perBaseQuality/packGpu.ts)
// Both pack ABGR on the CPU so the GPU and Canvas2D paths share the exact
// color (mod palette / quality ramp) with no UBO palette lookup. They stay
// separate GPU pipelines (distinct instance buffers, distinct pass ids) but
// reference this one shader so the two can never silently drift.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint position    : ATTR0;
  uint y           : ATTR1;
  uint packedColor : ATTR2;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float2 xx = expandMinWidthX(
    bpToClipX(inst.position, u),
    bpToClipX(inst.position + 1u, u),
    u.canvasW);
  float sx1 = xx.x;
  float sx2 = xx.y;

  float2 yy = pileupY(float(inst.y), u);
  o.position = float4(flipX(lerp(sx1, sx2, local.x), u), lerp(yy.y, yy.x, local.y), 0.0, 1.0);
  o.color = unpackRGBA(inst.packedColor);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}

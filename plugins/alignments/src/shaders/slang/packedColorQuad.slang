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

  // `pileupCellX` (alignmentsUniforms), the same anchored cell span
  // mismatch.slang measures — these two passes paint over each other, and a
  // modification cell that widened about its midpoint sat a column left of the
  // mismatch cell on the same base.
  float2 xx = pileupCellX(inst.position, u);

  float2 yy = pileupY(float(inst.y), u);
  o.position = flippedQuadPos(xx.x, xx.y, yy.y, yy.x, local, u);
  o.color = unpackRGBA(inst.packedColor);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}

// MAF alignment renderer. One pass renders colored quads for each base
// rectangle (matches, mismatches, gaps). Text rendering is handled by the
// Canvas2D backend. rowIndex is stored in the instance so row layout can be
// adjusted purely via uniforms — no refetch on rowHeight change.
//
// Colors are baked into the instance (one packed ABGR per run) so the
// main-thread encoder (`buildInstanceBuffer`, called from
// the per-region encode autorun in `LinearMafDisplay`) can run-merge consecutive
// same-colored cells — keeping the per-region quad count proportional to
// the number of color transitions, not the number of bases. Theme /
// setting changes re-encode on the main thread; no RPC roundtrip.
//
// NOTE: multiRow.slang (canvas plugin) is currently an exact copy of this
// shader — same instance layout, same uniforms, same vertex body — because both
// draw the same primitive (a colored rect spanning [startBp,endBp) on a row).
// They are NOT linked by anything, so a change here probably belongs there too;
// check before assuming otherwise. The two renderers already diverge on the
// viewportWidth *unit* they feed (see GpuMafRenderer), which is deliberate and
// not a reason to unify the shaders.
//! targets: wgsl, glsl

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;

struct MafInstance {
  uint startBp  : ATTR0;
  uint endBp    : ATTR1;
  uint rowIndex : ATTR2;
  uint color    : ATTR3;  // packed ABGR
};

struct Uniforms {
  float3 bpRangeX;      // [bpStartHi, bpStartLo, ±clippedLengthBp]
  float  canvasHeight;  // CSS px
  float  viewportWidth;
  float  zero;          // always 0.0 — prevents hp-split collapse
  float  rowHeight;     // CSS px per row
  float  rowProportion; // rect height = rowHeight * rowProportion
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(MafInstance inst, uint vid : SV_VertexID) {
  float2 local = quadLocal(vid);

  // Compute rect Y from row index and display settings (no refetch on resize).
  float h      = u.rowHeight * u.rowProportion;
  float offset = (u.rowHeight - h) * 0.5;
  float rowY   = offset + u.rowHeight * float(inst.rowIndex);

  float sx1 = bpToClipX(inst.startBp, u);
  float sx2 = bpToClipX(inst.endBp, u);

  sx2 = extendToMinWidthX(sx1, sx2, 1.0, u.viewportWidth);

  float clipX = lerp(sx1, sx2, local.x);

  float yPx  = lerp(rowY, rowY + h, local.y);
  float clipY = yPxToClipY(yPx, u.canvasHeight);

  VsOut o;
  o.position = float4(clipX, clipY, 0.0, 1.0);
  o.color    = unpackRGBA(inst.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  return v.color;
}

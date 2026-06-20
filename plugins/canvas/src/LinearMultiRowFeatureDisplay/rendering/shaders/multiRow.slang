// Multi-row feature painter ("chromosome painting"). One instance per feature:
// a colored rectangle spanning [startBp,endBp) in absolute genomic coords, on
// the row given by rowIndex. Mirrors maf.slang's primitive — genomic->pixel via
// the shared hp-math transform, rows from rowIndex*rowHeight, per-instance ABGR
// color — but features are already intervals (no per-base run-merging upstream).
// rowProportion shrinks the rect within its row to leave inter-row gaps.
//! targets: wgsl, glsl

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;

struct RowInstance {
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
VsOut vs_main(RowInstance inst, uint vid : SV_VertexID) {
  float2 local = quadLocal(vid);

  // Rect Y from row index + display settings (no refetch on resize).
  float h      = u.rowHeight * u.rowProportion;
  float offset = (u.rowHeight - h) * 0.5;
  float rowY   = offset + u.rowHeight * float(inst.rowIndex);

  float sx1 = bpToClipX(inst.startBp, u);
  float sx2 = bpToClipX(inst.endBp, u);

  // Enforce minimum 1-pixel width at any zoom so a sub-pixel feature still
  // paints. Reversal is baked into bpRangeX (negated length), so extend in the
  // sign direction of dx to preserve orientation (see maf.slang).
  float minClipW = 1.0 / u.viewportWidth * 2.0;
  float dx = sx2 - sx1;
  if (abs(dx) < minClipW) {
    sx2 = sx1 + (dx < 0.0 ? -minClipW : minClipW);
  }

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

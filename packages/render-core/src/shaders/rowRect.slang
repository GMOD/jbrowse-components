// Shared "row of colored rects" primitive: one instance is a rectangle
// spanning [startBp, endBp) in absolute genomic coords, drawn on the row given
// by `rowIndex` and filled with a per-instance packed ABGR color.
//
// Two renderers draw exactly this: the MAF alignment renderer (run-merged
// per-base cells) and the multi-row feature painter / "chromosome painting"
// (features are already intervals). They shipped as byte-identical copies of
// one another joined only by a "probably belongs there too" comment; owning the
// geometry here makes a change to the primitive land in both by construction.
//
// Row placement comes from uniforms rather than the instance data, so a
// rowHeight / rowProportion change re-renders without a refetch.
//
// What the two callers legitimately differ on is the *unit* they write into
// `viewportWidth` (CSS px vs device px), which only moves the min-width floor —
// see GpuMafRenderer's note. That is a uniform-write decision, not a reason for
// two shaders.
module rowRect;

import colorPack;
import hpmath;

public struct RowRectInstance {
  public uint startBp  : ATTR0;
  public uint endBp    : ATTR1;
  public uint rowIndex : ATTR2;
  public uint color    : ATTR3;  // packed ABGR
};

public struct RowRectUniforms {
  public float3 bpRangeX;      // [bpStartHi, bpStartLo, ±clippedLengthBp]
  public float  canvasHeight;  // CSS px
  // Width the 1px min-cell floor is measured against; the caller picks CSS or
  // device px (see the module header).
  public float  viewportWidth;
  public float  zero;          // always 0.0 — prevents hp-split collapse
  public float  rowHeight;     // CSS px per row
  public float  rowProportion; // rect height = rowHeight * rowProportion
};

public struct RowRectVsOut {
  public float4 position : SV_Position;
  public float4 color    : COLOR0;
};

public RowRectVsOut rowRectVertex(
  RowRectInstance inst, uint vid, RowRectUniforms u
) {
  float2 local = quadLocal(vid);

  float h      = u.rowHeight * u.rowProportion;
  float offset = (u.rowHeight - h) * 0.5;
  float rowY   = offset + u.rowHeight * float(inst.rowIndex);

  float sx1 = hpToClipX(hpSplitUint(inst.startBp), u.bpRangeX, u.zero);
  float sx2 = hpToClipX(hpSplitUint(inst.endBp), u.bpRangeX, u.zero);
  sx2 = extendToMinWidthX(sx1, sx2, 1.0, u.viewportWidth);

  float yPx = lerp(rowY, rowY + h, local.y);

  RowRectVsOut o;
  o.position = float4(
    lerp(sx1, sx2, local.x), yPxToClipY(yPx, u.canvasHeight), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  return o;
}

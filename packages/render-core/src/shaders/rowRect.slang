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
// two shaders. It is also unsettled, and device px additionally makes MAF's
// floor depend on the reader's monitor:
// `agent-docs/ideas/maf-subpixel-cells.md`.
//! export-consts: MIN_DRAWN_ROW_PX
//! js-export: drawnRowHeightPx, rowBandOffsetPx
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
  // Rows-area scroll offset in CSS px. The canvas is the viewport, not the
  // content: a caller whose rows overflow it paints row i at
  // `rowHeight*i - scrollTop` and lets the off-screen rows clip. Callers that
  // size their canvas to the content (the multi-row painter) write 0.
  public float  scrollTop;
};

public struct RowRectVsOut {
  public float4 position : SV_Position;
  public float4 color    : COLOR0;
};

// Thinnest a row is ever painted. Vertical twin of the min-width floor used
// below: a row thinner than a pixel can miss every pixel center and disappear,
// so without this rows drop out as they get denser instead of just getting
// thinner. Floored, neighbours overlap instead.
static const float MIN_DRAWN_ROW_PX = 1.0;

public struct RowBand {
  public float height;  // what the rect is painted at
  public float offset;  // inset from the row's top, negative once floored
};

// The band a row's rects occupy, as two scalars so `//! js-export` can lift
// them: rowBand.ts is the Canvas2D painter's, the indel glyphs' and the hover
// box's definition of the same band, and a row drawn here but hit-tested there
// has to land in the same place. The struct below is only packaging for the
// vertex stage.
//
// Centered, so a floored band overhangs its row evenly on both sides rather
// than pushing every row down.
public float drawnRowHeightPx(float rowHeight, float rowProportion) {
  return max(rowHeight * rowProportion, MIN_DRAWN_ROW_PX);
}

public float rowBandOffsetPx(float rowHeight, float rowProportion) {
  return (rowHeight - drawnRowHeightPx(rowHeight, rowProportion)) * 0.5;
}

public RowBand rowBandPx(float rowHeight, float rowProportion) {
  RowBand band;
  band.height = drawnRowHeightPx(rowHeight, rowProportion);
  band.offset = rowBandOffsetPx(rowHeight, rowProportion);
  return band;
}

public RowRectVsOut rowRectVertex(
  RowRectInstance inst, uint vid, RowRectUniforms u
) {
  float2 local = quadLocal(vid);

  RowBand band = rowBandPx(u.rowHeight, u.rowProportion);
  float h      = band.height;
  float rowY   = band.offset + u.rowHeight * float(inst.rowIndex) - u.scrollTop;

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

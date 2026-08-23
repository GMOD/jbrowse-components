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
// What the two callers legitimately differ on is the min-width floor: both the
// width they write into `minCellPx` and the *unit* they measure it in, via
// `viewportWidth` (CSS px vs device px) — see GpuMafRenderer's note. Those are
// uniform-write decisions, not a reason for two shaders. The unit is also
// unsettled, and device px additionally makes MAF's floor depend on the
// reader's monitor: `agent-docs/ideas/maf-subpixel-cells.md`.
//! export-consts: MIN_DRAWN_ROW_PX, MIN_DRAWN_CELL_PX, MULTI_ROW_MIN_CELL_PX
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
  // Width the min-cell floor is measured against; the caller picks CSS or
  // device px (see the module header).
  public float  viewportWidth;
  // Narrowest a cell is painted, in whatever unit `viewportWidth` is in.
  // MIN_DRAWN_CELL_PX is the floor a caller takes when it has no reason to
  // widen further; the multi-row painter does (see MULTI_ROW_MIN_CELL_PX).
  public float  minCellPx;
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

// Thinnest a row is ever painted. Vertical twin of MIN_DRAWN_CELL_PX below: a
// row thinner than a pixel can miss every pixel center and disappear, so
// without this rows drop out as they get denser instead of just getting
// thinner. Floored, neighbours overlap instead.
static const float MIN_DRAWN_ROW_PX = 1.0;

// Thinnest a cell can be painted and still be drawable at all, for the same
// reason as the row floor above on the other axis. A caller writes this into
// `minCellPx` when a cell being *visible* is not its problem, only a cell
// existing; one whose whole encoding is carried by sub-pixel cells asks for
// more (MULTI_ROW_MIN_CELL_PX).
//
// One caller mirrors it on the Canvas2D side and one deliberately does not: the
// multi-row painter floors, MAF draws cells at their natural sub-pixel width.
// That asymmetry is real and parked in `agent-docs/ideas/maf-subpixel-cells.md`;
// sharing the constant does not decide it, it just stops the value being
// anonymous in the places that DO agree.
static const float MIN_DRAWN_CELL_PX = 1.0;

// What the multi-row painter ("chromosome painting") writes into `minCellPx`.
//
// Wider than a pixel because this display has no second channel to fall back
// on. MAF's cells tile the row, so a sub-pixel cell sits in a run of its
// neighbours and the run is what is read; a painting's features are sparse
// intervals, and at chromosome zoom a RepeatMasker element is a single tick
// against white paper with nothing beside it. At one pixel — anti-aliased
// across two, so neither reaches full opacity — the tick reads as a smudge, and
// the eye scanning for structure across the rows finds none.
//
// Both floors distort width; that is what a floor is. This one distorts more,
// and only where the alternative was showing nothing legible: a feature wide
// enough to matter is already past it.
static const float MULTI_ROW_MIN_CELL_PX = 2.0;

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
  sx2 = extendToMinWidthX(sx1, sx2, u.minCellPx, u.viewportWidth);

  float yPx = lerp(rowY, rowY + h, local.y);

  RowRectVsOut o;
  o.position = float4(
    lerp(sx1, sx2, local.x), yPxToClipY(yPx, u.canvasHeight), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  return o;
}

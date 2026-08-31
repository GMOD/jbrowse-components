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
// What the callers legitimately differ on is the min-width floor they write
// into `minCellPx` — a uniform-write decision, not a reason for two shaders.
// Whether to floor at all turns on whether the caller's marks TILE: MAF's cells
// do, so a sub-pixel one is read as part of the run around it and widening it
// paints ink the alignment does not contain (measured, and MAF now passes 0 —
// `agent-docs/reference/MAF_SUBPIXEL_CELLS.md`). The multi-row painter's features
// are sparse intervals with nothing beside them, so it floors.
//! export-consts: MIN_DRAWN_ROW_PX, MULTI_ROW_MIN_CELL_PX
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
  // The width `minCellPx` is measured against, and so the thing that decides
  // what unit `minCellPx` IS. Named for that rather than for the viewport
  // because the callers that floor pass a CSS width. Pass a DEVICE width and
  // the floor moves with the reader's monitor — MAF did, and rendered
  // measurably differently on a retina screen until it stopped flooring.
  public float  minCellDenomPx;
  // Narrowest a cell is painted, in whatever unit `minCellDenomPx` is in. Zero
  // is a no-op and is what a tiling caller writes (MAF); the multi-row painter
  // names its own width, MULTI_ROW_MIN_CELL_PX.
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

// Thinnest a row is ever painted: a row thinner than a pixel can miss every
// pixel center and disappear, so without this rows drop out as they get denser
// instead of just getting thinner. Floored, neighbours overlap instead.
//
// There is no X-axis twin. A row is a container the reader is counting, so
// losing one loses a species; a cell is a sample of a tiling, so losing one to
// the blend is the honest answer and flooring it invents ink
// (`agent-docs/reference/MAF_SUBPIXEL_CELLS.md`). The caller that does want an X
// floor names its own width, below.
static const float MIN_DRAWN_ROW_PX = 1.0;

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
// A floor distorts width; that is what a floor is. This is the only caller that
// takes the trade, and only where the alternative was showing nothing legible:
// a feature wide enough to matter is already past it.
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

// The shape's geometry alone — row band, hp clip-x span, min-width widening —
// so a consumer whose colour is not a per-instance packed value (wiggle
// density: a per-instance score through a uniform scale) composes the same
// rect without routing a resolved colour through the instance buffer.
// `rowIndex` is float here because the row transform is float arithmetic;
// each caller converts at its own boundary (`RowRectInstance` stores uint,
// wiggle's fill record stores float).
public float4 rowRectClipPos(
  uint startBp, uint endBp, float rowIndex, uint vid, RowRectUniforms u
) {
  float2 local = quadLocal(vid);

  RowBand band = rowBandPx(u.rowHeight, u.rowProportion);
  float rowY   = band.offset + u.rowHeight * rowIndex - u.scrollTop;

  float sx1 = hpToClipX(hpSplitUint(startBp), u.bpRangeX, u.zero);
  float sx2 = hpToClipX(hpSplitUint(endBp), u.bpRangeX, u.zero);
  sx2 = extendToMinWidthX(sx1, sx2, u.minCellPx, u.minCellDenomPx);

  float yPx = lerp(rowY, rowY + band.height, local.y);

  return float4(
    lerp(sx1, sx2, local.x), yPxToClipY(yPx, u.canvasHeight), 0.0, 1.0);
}

public RowRectVsOut rowRectVertex(
  RowRectInstance inst, uint vid, RowRectUniforms u
) {
  RowRectVsOut o;
  o.position = rowRectClipPos(
    inst.startBp, inst.endBp, float(inst.rowIndex), vid, u);
  o.color = unpackRGBA(inst.color);
  return o;
}

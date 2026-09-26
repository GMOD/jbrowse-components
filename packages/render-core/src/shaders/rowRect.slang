// Shared "row of colored rects" primitive: one instance is a rectangle
// spanning [x, x2) in absolute genomic coords, drawn on the row given by
// `row` and filled with a per-instance packed ABGR color.
//
// The `span` mark draws exactly this for MAF (run-merged per-base cells) and
// the multi-row feature painter (features are already intervals), and wiggle
// density composes the same rect over a colour of its own.
//
// Row placement comes from uniforms rather than the instance data, so a
// rowHeight / rowProportion change re-renders without a refetch.
//
// What the callers legitimately differ on is the min-width floor they write
// into `minCellPx` — a uniform-write decision, not a reason for two shaders.
// Whether to floor at all turns on whether the caller's marks leave GAPS: a
// floored quad grows off its start edge, so a neighbour abutting it covers the
// growth and the floor paints nothing extra. The multi-row painter's features
// are sparse intervals with nothing beside them, so it floors; MAF's cells
// never gap and it passes 0; wiggle density tiles at most zooms and gaps where
// its source does, so it floors and pays nothing for it on the tiling. Both
// halves measured — `agent-docs/reference/MAF_SUBPIXEL_CELLS.md`.
//! export-consts: MIN_DRAWN_ROW_PX, MULTI_ROW_MIN_CELL_PX
//! js-export: drawnRowHeightPx, rowBandOffsetPx
module rowRect;

import hpmath;

public struct RowRectInstance {
  public uint x     : ATTR0;
  public uint x2    : ATTR1;
  public uint row   : ATTR2;
  public uint color : ATTR3;  // packed ABGR
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
  // is a no-op, and over marks that tile so is every other value; what a floor
  // decides is what a GAP next to a sub-pixel mark looks like. MAF writes 0,
  // the multi-row painter MULTI_ROW_MIN_CELL_PX, wiggle density
  // MIN_FILL_WIDTH_PX.
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

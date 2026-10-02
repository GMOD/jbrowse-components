// Multi-variant display — one instance per variant cell. Emits a
// bounding-box quad; the fragment shader uses an SDF to carve the inversion
// glyph, a bar pointed at its left end, out of the quad when shapeType != RECT.
//! targets: wgsl, glsl
//! blend: premultiplied
//! export-consts: SHAPE_RECT, SHAPE_TRI_LEFT, MIN_CELL_PX
//! js-export: drawnCellHeightPx, snappedCellWidthPx, snappedCellLeftPx, inversionTipPx
//! js-skip: snapCellEdgePx — reached as a private helper inside the generated snappedCellWidthPx and snappedCellLeftPx, so the grid it snaps to is already shared without being public. The pair is what a consumer should ask: a snapped edge on its own has lost the record order those two read to place the 2px floor

import antialias;
import hpmath;
import colorPack;


public static const uint VERTS_PER_INSTANCE = 6u;

// The glyph vocabulary the instance buffer's `shapeType` lane speaks, owned here
// and generated into TS — the same way manhattan.slang owns GLYPH_POINT/
// GLYPH_INSERTION/GLYPH_INDEX, wiggle owns RENDERING_TYPE_*, and syntenyTypes
// owns its KIND_* boundary. This pair was the one still going the other way:
// declared in `../variantShape.ts` and held against the shader by a "keep in
// sync there" comment, with the fragment stage testing a bare `0u`.
//
// An inversion is symmetric — VCF sets no strand on a variant record — so one
// triangle covers it and the vocabulary is two values rather than a left/right
// pair.
static const uint SHAPE_RECT = 0u;
static const uint SHAPE_TRI_LEFT = 1u;

// Height a cell is painted at. The 2px floor keeps a lone cell in a sparse
// matrix visible (matching the 2px min width) rather than fading to a sub-pixel
// sliver, while preserving draw order for variant priority.
//
// `//! js-export`ed: the Canvas2D draw and the hit test both need the same
// band, and both spelled `Math.max(rowHeight, 2)` under comments naming this
// one. A cell painted taller than it hit-tests is unclickable along its bottom
// edge — a difference nothing but a user would notice.
float drawnCellHeightPx(float rowHeight) {
  return max(rowHeight, 2.0);
}

// Snap a cell edge to the pixel grid. The Canvas2D backend and the SVG export
// both have to land on the pixels the GPU already drew — at genome-wide zoom
// every variant is thinner than 1px, so a half-pixel disagreement is not a
// corner case there, it is every cell — and they get that by importing the two
// functions below, which reach this one inside the generated module.
//
// The shader snaps in viewport px and a CPU painter in canvas px, and the two
// grids agree because the viewport's left edge (`scissorX`) is a whole pixel.
float snapCellEdgePx(float xPx) {
  return floor(xPx + 0.5);
}

// A snapped cell paints at least MIN_CELL_PX wide, so a lone variant in a
// sparse matrix stays visible rather than collapsing to a sliver.
static const float MIN_CELL_PX = 2.0;
//
// Both this and its pivot twin below take the cell's RAW px edges in RECORD
// order — `toX(start)`, `toX(end)` — and snap inside. That is deliberate: on a
// reversed block the record's start is its *right* edge, and once both edges are
// snapped a sub-pixel record has both of them on the same pixel, so the pivot
// can no longer tell which way the block ran. Since that is every record at
// genome-wide zoom, a pivot reading snapped edges would be a no-op exactly where
// it is needed. Raw in, decision inside, so the orientation survives the snap.
float snappedCellWidthPx(float x1Px, float x2Px) {
  return max(MIN_CELL_PX, abs(snapCellEdgePx(x2Px) - snapCellEdgePx(x1Px)));
}

// Which edge the widened cell hangs off: the record's START, always.
//
// This is `spanLeft`/`extendToMinWidthPx`'s pivot, the one every painter with a
// min-width floor needs and the one that keeps being got wrong — the canvas rect
// painter (2px), the multi-row painter (1px) and wiggle (1.5px) each had it
// independently, and the cells here were the fourth. Anchoring the leftmost edge
// and growing right is identical on a forward block and anchors the record's
// *end* on a reversed one, sliding every sub-pixel cell a full floor-width
// toward the block's end — off the ruler, and off the same VCF drawn in a
// LinearVariantDisplay beside it, which pivots correctly.
//
// `widthPx` is passed rather than recomputed so the floor stays one expression.
float snappedCellLeftPx(float x1Px, float x2Px, float widthPx) {
  float startPx = snapCellEdgePx(x1Px);
  return x2Px < x1Px ? startPx - widthPx : startPx;
}

// How far the inversion glyph's point reaches into the cell: the cell's own
// height, so the tip keeps one angle whatever the cell's width, and the rest
// of a wide cell is solid. A tip spanning the whole width drew an 11 Mb
// inversion in 2 px rows as a 900 px sliver whose antialiased edges read as a
// fade from white at one breakpoint to full colour at the other
// (popgen/in2lt_inversion). A cell no wider than it is tall is the same
// triangle it was.
//
// `//! js-export`ed: the Canvas2D twin and the SVG export trace the same
// outline.
float inversionTipPx(float widthPx, float heightPx) {
  return min(widthPx, heightPx);
}

struct CellInstance {
  uint2 startEnd  : ATTR0;
  uint  row       : ATTR1;
  uint  shapeType : ATTR2;
  uint  color     : ATTR3;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  // The clipped block's width, i.e. the draw's viewport/scissor span — what
  // clip-space x actually spans, so it alone converts clip px.
  float  viewportWidth;
  float  rowHeight;
  float  scrollTop;
  float  zero;
  float  devicePixelRatio;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPx  : COLOR1;
  nointerpolation float2 sizePx    : COLOR2;
  nointerpolation uint   shapeType : COLOR3;
  // The tip's length and the hypotenuse term of its two sloped edges,
  // precomputed so the fragment stage takes no sqrt.
  nointerpolation float  tipPx     : COLOR4;
  nointerpolation float  hypTip    : COLOR5;
};

[shader("vertex")]
VsOut vs_main(CellInstance inst, uint vid : SV_VertexID) {
  float clipX1 = bpToClipX(inst.startEnd.x, u);
  float clipX2 = bpToClipX(inst.startEnd.y, u);
  // Pixel-snap + 2px floor, in px space (see snapCellEdgePx) so the CPU runs the
  // identical rounding. clipX/pxSize is already `px - viewportWidth/2` — the
  // viewport spans the clipped block, so its width converts clip px.
  //
  // The edges stay in RECORD order: reversal is baked into bpRangeX (negated
  // length), so clipX2 < clipX1 on a reversed region, and that is exactly what
  // snappedCellLeftPx needs to know. Ordering them left/right first would throw
  // the orientation away before the pivot could read it.
  float pxSize = pxToClipLen(1.0, u.viewportWidth);
  float halfW = u.viewportWidth * 0.5;
  float rx1 = clipX1 / pxSize + halfW;
  float rx2 = clipX2 / pxSize + halfW;
  float wPx = snappedCellWidthPx(rx1, rx2);
  float x1Px = snappedCellLeftPx(rx1, rx2, wPx);
  float cx1 = (x1Px - halfW) * pxSize;
  float cx2 = (x1Px + wPx - halfW) * pxSize;

  // fractional y keeps subpixel rows smooth (no rounding = no discrete jumps
  // during resize); the floor is drawnCellHeightPx, below.
  float yTop = float(inst.row) * u.rowHeight - u.scrollTop;
  float yBot = yTop + drawnCellHeightPx(u.rowHeight);
  float cyTop = yPxToClipY(yTop, u.canvasHeight);
  float cyBot = yPxToClipY(yBot, u.canvasHeight);

  float2 q = quadLocal(vid);
  float lx = q.x, ly = q.y;

  float hPx = drawnCellHeightPx(u.rowHeight);

  VsOut o;
  o.position = float4(lerp(cx1, cx2, lx), lerp(cyBot, cyTop, ly), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.localPx = float2(lx * wPx, (1.0 - ly) * hPx);
  o.sizePx = float2(wPx, hPx);
  o.shapeType = inst.shapeType;
  o.tipPx = inversionTipPx(wPx, hPx);
  o.hypTip = sqrt(hPx * hPx * 0.25 + o.tipPx * o.tipPx);
  return o;
}

// Inside-positive distance to the inversion glyph: a bar whose left end comes
// to a point at mid-height, the point `tip` px long. `p` is the fragment in
// cell px from the cell's top-left. The two sloped edges run from the apex
// (0, h/2) to (tip, 0) and (tip, h); past the tip the bar's top and bottom
// edges take over.
float inversionSdf(float2 p, float w, float h, float tip, float hyp) {
  float fromTip = tip - p.x;
  float dTop = (-0.5 * h * fromTip + tip * p.y) / hyp;
  float dBot = (-0.5 * h * fromTip - tip * (p.y - h)) / hyp;
  float dBar = min(min(w - p.x, p.y), h - p.y);
  return min(min(dTop, dBot), dBar);
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float alpha = fragIn.color.a;

  // Any non-rect cell is an inversion, drawn as a left-pointing bar via its
  // SDF. Tested as "not RECT" rather than "== TRI_LEFT" so a third shape added
  // to the vocabulary above draws SOMETHING here rather than silently falling
  // back to a plain box.
  if (fragIn.shapeType != SHAPE_RECT) {
    float d = inversionSdf(fragIn.localPx, fragIn.sizePx.x, fragIn.sizePx.y, fragIn.tipPx, fragIn.hypTip);
    // No whole-mark size fade here: both cell sides floor at 2px, so one is a
    // constant dim on the inversion alone (inversionGlyphInk.test.ts).
    alpha *= edgeCoverage(d, u.devicePixelRatio);
  }

  return float4(fragIn.color.rgb * alpha, alpha);
}

// Multi-variant display — one instance per variant cell. Emits a
// bounding-box quad; the fragment shader uses an SDF to carve the inversion
// triangle glyph out of the quad when shapeType != RECT.
//! targets: wgsl, glsl
//! blend: premultiplied
//! export-consts: SHAPE_RECT, SHAPE_TRI_LEFT
//! js-export: drawnCellHeightPx, snappedCellWidthPx, snappedCellLeftPx
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
// The half-canvas offset is not decoration. Clip space is 2 units across
// `canvasWidth` px, so the shader's natural `floor(clipX / pxSize + 0.5)` rounds
// about the canvas *centre*: whole pixels when the width is even, half pixels
// when it is odd. A plain round() on the CPU would agree only half the time.
float snapCellEdgePx(float xPx, float canvasWidth) {
  float half = canvasWidth * 0.5;
  return floor(xPx - half + 0.5) + half;
}

// A snapped cell paints at least 2px wide, so a lone variant in a sparse matrix
// stays visible rather than collapsing to a sliver.
//
// Both this and its pivot twin below take the cell's RAW px edges in RECORD
// order — `toX(start)`, `toX(end)` — and snap inside. That is deliberate: on a
// reversed block the record's start is its *right* edge, and once both edges are
// snapped a sub-pixel record has both of them on the same pixel, so the pivot
// can no longer tell which way the block ran. Since that is every record at
// genome-wide zoom, a pivot reading snapped edges would be a no-op exactly where
// it is needed. Raw in, decision inside, so the orientation survives the snap.
float snappedCellWidthPx(float x1Px, float x2Px, float canvasWidth) {
  return max(2.0, abs(
    snapCellEdgePx(x2Px, canvasWidth) - snapCellEdgePx(x1Px, canvasWidth)));
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
float snappedCellLeftPx(
  float x1Px, float x2Px, float canvasWidth, float widthPx
) {
  float startPx = snapCellEdgePx(x1Px, canvasWidth);
  return x2Px < x1Px ? startPx - widthPx : startPx;
}

struct CellInstance {
  uint2 startEnd  : ATTR0;
  uint  rowIndex  : ATTR1;
  uint  shapeType : ATTR2;
  uint  color     : ATTR3;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  canvasWidth;
  float  rowHeight;
  float  scrollTop;
  float  zero;
  // The inversion triangle's edge ramp is one OUTPUT pixel, and `localPx` is
  // CSS px — so the fragment needs the ratio between them. The only device-px
  // quantity in this block.
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
  // Precomputed hypotenuse term for the triangle SDF — avoids a per-fragment
  // sqrt. hypRight = sqrt(h*h*0.25 + w*w).
  nointerpolation float  hypRight  : COLOR4;
};

[shader("vertex")]
VsOut vs_main(CellInstance inst, uint vid : SV_VertexID) {
  float clipX1 = bpToClipX(inst.startEnd.x, u);
  float clipX2 = bpToClipX(inst.startEnd.y, u);
  // Pixel-snap + 2px floor, in px space (see snapCellEdgePx) so the CPU runs the
  // identical rounding. clipX/pxSize is already `px - canvasWidth/2`, so adding
  // the half-width back is all the conversion this needs.
  //
  // The edges stay in RECORD order: reversal is baked into bpRangeX (negated
  // length), so clipX2 < clipX1 on a reversed region, and that is exactly what
  // snappedCellLeftPx needs to know. Ordering them left/right first would throw
  // the orientation away before the pivot could read it.
  float pxSize = pxToClipLen(1.0, u.canvasWidth);
  float halfW = u.canvasWidth * 0.5;
  float rx1 = clipX1 / pxSize + halfW;
  float rx2 = clipX2 / pxSize + halfW;
  float wPx = snappedCellWidthPx(rx1, rx2, u.canvasWidth);
  float x1Px = snappedCellLeftPx(rx1, rx2, u.canvasWidth, wPx);
  float cx1 = (x1Px - halfW) * pxSize;
  float cx2 = (x1Px + wPx - halfW) * pxSize;

  // fractional y keeps subpixel rows smooth (no rounding = no discrete jumps
  // during resize); the floor is drawnCellHeightPx, below.
  float yTop = float(inst.rowIndex) * u.rowHeight - u.scrollTop;
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
  o.hypRight = sqrt(hPx * hPx * 0.25 + wPx * wPx);
  return o;
}

float triSdfRight(float2 p, float w, float h, float hyp) {
  float dLeft = p.x;
  float dTop = (-0.5 * h * p.x + w * p.y) / hyp;
  float dBot = (-0.5 * h * p.x - w * (p.y - h)) / hyp;
  return min(min(dLeft, dTop), dBot);
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float alpha = fragIn.color.a;

  // Any non-rect cell is an inversion, drawn as a left-pointing triangle via a
  // mirrored right-triangle SDF. Tested as "not RECT" rather than "== TRI_LEFT"
  // so a third shape added to the vocabulary above draws SOMETHING here rather
  // than silently falling back to a plain box.
  if (fragIn.shapeType != SHAPE_RECT) {
    float w = fragIn.sizePx.x;
    float h = fragIn.sizePx.y;
    float d = triSdfRight(float2(w - fragIn.localPx.x, fragIn.localPx.y), w, h, fragIn.hypRight);
    // `d` is a true perpendicular distance in CSS px, so the ramp is analytic
    // and one device pixel wide. It was `smoothstep(-0.5, 0.5, d)`: a CSS-px
    // width, so twice as soft on a retina screen as on a plain one, and the
    // cubic shape antialias.slang measured and rejected — up to 0.067 of full
    // ink out at 45 degrees against the linear ramp's 0.043, on a mark whose
    // whole distinguishing feature is a diagonal.
    alpha *= edgeCoverage(d, u.devicePixelRatio);
    // NOT an edge ramp: a whole-mark size fade, in CSS px on purpose, so a
    // sub-pixel cell dims instead of flickering. Nothing here measures a
    // distance to an edge.
    alpha *= smoothstep(0.0, 3.0, min(w, h));
  }

  return float4(fragIn.color.rgb * alpha, alpha);
}

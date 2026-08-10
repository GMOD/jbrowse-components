// Per-instance rectangle renderer for canvas feature glyphs.
//
// Uses vertex-attribute instancing on both backends (see ADR-005). The
// matching PassDescriptor must set `vertexBuffer: true`. Slang's WGSL output
// emits `@location(N)` vertex inputs that the WebGPU HAL wires up via
// vertex.buffers; Slang's GLSL output emits `in T a_field;` declarations
// that WebGL2 binds via `vertexAttribPointer` / `vertexAttribIPointer`.
//! targets: wgsl, glsl
//! export-consts: MIN_RECT_WIDTH_PX, MIN_DENSITY_ALPHA
//! js-export: rectSpanPx

import hpmath;
import colorPack;
import featureGlyphUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
static const float MIN_RECT_WIDTH_PX = 2.0;
// In the dense-pileup regime — thousands of sub-pixel marks collapsed onto row 0
// (densityFade flag set), the min-width clamp widening each to abut its neighbors
// (e.g. a dense SNP track collapsing to solid orange) — drawing them
// semi-transparent lets the standard src-alpha blend accumulate where features
// overlap, so density reads as opacity/texture instead of a flat fill. Sparse
// tracks and everything else stay fully opaque so individual features show.
//
// Kept low so the accumulated opacity 1-(1-a)^count stays proportional to the
// number of variants stacked at a pixel over a useful range (a=0.3: 1→.30,
// 3→.66, 5→.83, 10→.97) instead of saturating to a solid block after two or
// three overlaps. This is the knob that makes a dense variant pileup read as a
// density gradient; the src-alpha blend does the per-pixel counting.
static const float MIN_DENSITY_ALPHA = 0.3;

struct RectInstance {
  uint2 startEnd : ATTR0;
  float y        : ATTR1;
  float height   : ATTR2;
  uint  color    : ATTR3;
  // 1 = collapsed row-0 box in a dense pileup (thousands of marks) — only these
  // fade; 0 = anything else — a gene subfeature rect, a stacked box, or a sparse
  // collapsed mark — stays opaque.
  uint  densityFade : ATTR4;
};

// Binding 1 is the uniform across both the standard (storage+uniform) and
// uniform-only bind group layouts, so this binding annotation works under
// either HAL path. Binding 0 is left unused for vertex-buffer passes.
[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  float2 featSizePx : TEXCOORD1;
};

// The two screen-x edges a rect actually paints, given its unsnapped edges in
// px. Returns (left edge, right edge) as a SIGNED span: on a reversed block the
// render axis runs leftward, so x2 < x1 and the mark must grow that way. The
// vertex stage lerps between the pair; Canvas2D turns it into a fillRect x via
// `spanLeft`, which owns that pivot on its side.
//
// Two rules, and the split between them keys on `isPoint` — the caller's
// GENOMIC start == end — never on the snapped pixel width. Pixel snapping
// collapses plenty of real sub-pixel spans onto one pixel, and treating those
// as points would slide every one of them half a mark off its start edge.
//
//   - A degenerate span is an interbase POINT, not a box: a CRISPR or
//     restriction cut sits BETWEEN two bases, which is what a zero-length
//     interval means in the interbase coordinates the adapters emit. So the
//     min-width mark straddles the coordinate instead of growing off one side
//     of it — zoomed in far enough to read bases, a one-sided tick sits inside
//     the following base's cell and reads as "cuts this base". Centering is
//     orientation-free, so unlike extendToMinWidthPx it needs no reversed-block
//     special case.
//   - A real span is snapped at both ends, so a min-width box is a crisp >=2px
//     column rather than an anti-aliased blur, then widened away from its START
//     edge by `extendToMinWidthPx`.
//
// `//! js-export`ed: this is the first export whose decision is genuinely a
// PAIR rather than a scalar (adr-051), and the pair is the two arguments a
// Canvas2D rect fill is built from. Canvas2DFeatureRenderer's `paintedRectSpan`
// was a hand-written twin of it, down to relying on the widen being a no-op on
// the point branch.
//
// Working in PX and converting once at each end is not just tidier than the
// clip-space version this replaced — it is what makes the two backends agree.
// Measured in float32 against the old formulation over ~7.7k inputs (block
// widths 97..7680, sub-pixel offsets, spans either side of the 2px floor, both
// orientations):
//
//   - the SPAN branch is unchanged: 0 of 7317 cases differ by as much as half a
//     pixel, max delta 0.00024 px, and the min-width decision never flips.
//   - the POINT branch MOVED, on 19 of 369 cases, by a full pixel — 15 of them
//     at an exactly-half-pixel offset. The old code formed the ±half-width as
//     `2.0 / canvasWidth` in clip space, which is inexact for most widths, so
//     the perturbed value fell the other side of `floor(x + 0.5)`. Canvas2D
//     always did this arithmetic in px, so those were pixels where the GPU put
//     an interbase cut mark somewhere the Canvas2D and SVG paths did not.
//
// The round trip costs nothing: `snapToPixelX` was already doing clip→px→clip
// internally, twice, and hoisting it out leaves the same two conversions each
// way. The emitted shader is slightly smaller for it — 39 arithmetic ops
// reachable from `vs_main` against 43 before, same function count.
public float2 rectSpanPx(float x1Px, float x2Px, bool isPoint) {
  if (isPoint) {
    float half = MIN_RECT_WIDTH_PX * 0.5;
    return float2(floor(x1Px - half + 0.5), floor(x1Px + half + 0.5));
  }
  float left = floor(x1Px + 0.5);
  return float2(
    left, extendToMinWidthPx(left, floor(x2Px + 0.5), MIN_RECT_WIDTH_PX));
}

[shader("vertex")]
VsOut vs_main(RectInstance inst, uint vid : SV_VertexID) {
  float2 q = quadLocal(vid);
  float localX = q.x, localY = q.y;

  float cw = u.canvasWidth;
  float2 span = rectSpanPx(
    clipXToPx(bpToClipX(inst.startEnd.x, u), cw),
    clipXToPx(bpToClipX(inst.startEnd.y, u), cw),
    inst.startEnd.x == inst.startEnd.y
  );
  float sx1 = pxToClipX(span.x, cw);
  float sx2 = pxToClipX(span.y, cw);
  float sx = lerp(sx1, sx2, localX);

  float yTopPx = floor(inst.y - u.scrollY + 0.5);
  // snapBoxHeightPx, not a bare round: a thin box is drawn at an odd height so
  // the 1px glyphs riding on it (intron line, chevrons, strand arrow) have a
  // true center row to land on. The line/chevron/arrow shaders derive their y
  // from the same helper via snapBoxCenterY, so box and glyph agree by
  // construction.
  float yBotPx = yTopPx + snapBoxHeightPx(inst.height);
  float syTop = yPxToClipY(yTopPx, u.canvasHeight);
  float syBot = yPxToClipY(yBotPx, u.canvasHeight);
  float sy = lerp(syBot, syTop, localY);

  float widthPx  = abs(span.y - span.x);
  float heightPx = abs(yBotPx - yTopPx);

  // densityFade is already the layout's dense-pileup decision, so it alone gates
  // the fade — no width re-test.
  float densityAlpha = inst.densityFade != 0u ? MIN_DENSITY_ALPHA : 1.0;

  VsOut o;
  o.position   = float4(sx, sy, 0.0, 1.0);
  o.color      = unpackRGBA(inst.color);
  o.color.a   *= densityAlpha;
  o.localPos   = float2(localX, localY);
  o.featSizePx = float2(widthPx, heightPx);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (u.outlineColor != 0u) {
    float4 outlineRGBA = unpackRGBA(u.outlineColor);
    if (outlineRGBA.a > 0.0 && fragIn.featSizePx.x > 2.0 && fragIn.featSizePx.y > 2.0) {
      float dxL = fragIn.localPos.x * fragIn.featSizePx.x;
      float dxR = (1.0 - fragIn.localPos.x) * fragIn.featSizePx.x;
      float dy  = min(fragIn.localPos.y, 1.0 - fragIn.localPos.y) * fragIn.featSizePx.y;
      if (min(min(dxL, dxR), dy) < 1.0) {
        return outlineRGBA;
      }
    }
  }
  return fragIn.color;
}

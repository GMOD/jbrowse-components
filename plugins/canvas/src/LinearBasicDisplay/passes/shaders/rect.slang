// Per-instance rectangle renderer for canvas feature glyphs.
//
// Uses vertex-attribute instancing on both backends (see ADR-005). The
// matching PassDescriptor must set `vertexBuffer: true`. Slang's WGSL output
// emits `@location(N)` vertex inputs that the WebGPU HAL wires up via
// vertex.buffers; Slang's GLSL output emits `in T a_field;` declarations
// that WebGL2 binds via `vertexAttribPointer` / `vertexAttribIPointer`.
//! targets: wgsl, glsl
//! export-consts: MIN_RECT_WIDTH_PX, MIN_DENSITY_ALPHA
//! js-export: rectSpanPx, rectDrawsOutline

import hpmath;
import colorPack;
import featureGlyphUniforms;
import rectInstance;


public static const uint VERTS_PER_INSTANCE = 6u;
static const float MIN_RECT_WIDTH_PX = 2.0;
// Where sub-pixel marks collapsed onto row 0 pile several deep on each other's
// pixels (densityFade flag set — e.g. a dense SNP track collapsing to solid
// orange), drawing them semi-transparent lets the standard src-alpha blend
// accumulate, so density reads as opacity/texture instead of a flat fill, and so
// the marks underneath show at all. How deep the pile has to be is the layout's
// call and not re-tested here: see PILEUP_FADE_DEPTH, which waits for a third
// mark because the min-width clamp widens every mark to abut its neighbors, so a
// mere pair proves nothing. A mark with room around it, and everything else,
// stays opaque.
//
// Kept low so the accumulated opacity 1-(1-a)^count stays proportional to the
// number of variants stacked at a pixel over a useful range (a=0.3: 1→.30,
// 3→.66, 5→.83, 10→.97) instead of saturating to a solid block after two or
// three overlaps. This is the knob that makes a dense variant pileup read as a
// density gradient; the src-alpha blend does the per-pixel counting.
static const float MIN_DENSITY_ALPHA = 0.3;

// RectInstance lives in rectInstance.slang — the continuation pass draws from
// this same buffer, so the layout is declared once for both.

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
// Measured against the clip-space version this replaced, in float32, over ~7.7k
// inputs (block widths 97..7680, sub-pixel offsets, spans either side of the 2px
// floor, both orientations), because "the round trip is free" was an argument
// and not evidence:
//
//   - Free, slightly better than free: 39 arithmetic ops reachable from
//     `vs_main` against 43. `snapToPixelX` was already doing clip→px→clip
//     internally, twice, so hoisting it out adds no conversion.
//   - The SPAN branch is unchanged — 0 of 7317 cases differ by half a pixel,
//     and the min-width decision never flips.
//   - The POINT branch shifts by a pixel on 19 of 369 cases, mostly at exactly
//     half-pixel offsets, because the old code formed the ±half-width as
//     `2.0 / canvasWidth` in a normalized space. Recorded so nobody re-derives
//     it; not a reason to have made the change, and not worth chasing further.
//     Sub-pixel placement is best-effort between the backends (ARCHITECTURE.md,
//     "Keeping the two backends in parity") — what has to agree is the RULE:
//     that a degenerate span is a point at all, and straddles its coordinate.
public float2 rectSpanPx(float x1Px, float x2Px, bool isPoint) {
  if (isPoint) {
    float half = MIN_RECT_WIDTH_PX * 0.5;
    return float2(floor(x1Px - half + 0.5), floor(x1Px + half + 0.5));
  }
  float left = floor(x1Px + 0.5);
  return float2(
    left, extendToMinWidthPx(left, floor(x2Px + 0.5), MIN_RECT_WIDTH_PX));
}

// Whether a drawn box has room for the 1px outline inset inside it. Below this
// the stroke would meet itself from both sides and paint the box solid in the
// outline color, which reads as a wrong FILL rather than as a border.
//
// The threshold is 2px on each axis and is NOT `MIN_RECT_WIDTH_PX`, which
// happens to be 2 as well: that one is how wide a sub-pixel mark is grown TO,
// this one is how wide a box must be to take a border. They answer different
// questions and would move for different reasons, so the coincidence is spelled
// out rather than shared. Stated as a bare `2` here and again as a bare `2` in
// `drawRects` until it was lifted.
public bool rectDrawsOutline(float widthPx, float heightPx) {
  return widthPx > 2.0 && heightPx > 2.0;
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
    if (
      outlineRGBA.a > 0.0 &&
      rectDrawsOutline(fragIn.featSizePx.x, fragIn.featSizePx.y)
    ) {
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

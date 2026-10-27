// Per-instance rectangles for canvas feature glyphs, drawn by vertex-attribute
// instancing (ADR-005).
//! targets: wgsl, glsl
//! coverage: analytic
//! export-consts: MIN_RECT_WIDTH_PX, MIN_DENSITY_ALPHA
//! js-export: rectSpanPx, rectDrawsOutline

import hpmath;
import colorPack;
import featureGlyphUniforms;
import rectInstance;


public static const uint VERTS_PER_INSTANCE = 6u;
static const float MIN_RECT_WIDTH_PX = 2.0;
// Alpha for a mark the layout flagged `densityFade` (see PILEUP_FADE_DEPTH), so
// a pile of collapsed marks reads as density rather than a flat fill. The blend
// accumulates 1-(1-a)^n, and a low `a` keeps that tracking pile depth (0.3: 1
// mark .30, 3 marks .66, 10 marks .97) instead of saturating after two or three.
static const float MIN_DENSITY_ALPHA = 0.3;

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  nointerpolation float2 featSizePx : TEXCOORD1;
};

// The two screen-x edges a rect paints, from its unsnapped edges in px, as a
// SIGNED pair: on a reversed block x2 < x1 and the mark grows leftward.
// Canvas2D turns the pair into a fillRect x with `spanLeft`.
//
// `isPoint` is the caller's genomic start == end, never a snapped pixel width:
// snapping collapses real sub-pixel spans onto one pixel, and treating those as
// points would shift each one half a mark off its start.
//
//   - A point is an interbase position, such as a CRISPR cut between two bases,
//     so its min-width mark straddles the coordinate. A one-sided tick would sit
//     inside the next base's cell and read as "cuts this base".
//   - A span snaps both ends to a crisp column, then `extendToMinWidthPx` widens
//     it away from its start.
public float2 rectSpanPx(float x1Px, float x2Px, bool isPoint) {
  if (isPoint) {
    float half = MIN_RECT_WIDTH_PX * 0.5;
    return float2(floor(x1Px - half + 0.5), floor(x1Px + half + 0.5));
  }
  float left = floor(x1Px + 0.5);
  return float2(
    left, extendToMinWidthPx(left, floor(x2Px + 0.5), MIN_RECT_WIDTH_PX));
}

// Whether a box has room for its 1px inset outline. Any smaller and the stroke
// meets itself, painting the box solid in the outline color.
//
// The 2 is not MIN_RECT_WIDTH_PX: that is how wide a sub-pixel mark grows, this
// is how wide a box must be to take a border, and the two would change for
// different reasons.
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

  // Not a bare round of each edge: snapBoxHeightPx gives a thin box an odd
  // height, so the 1px glyphs riding on it have a center row, and snapBoxTopPx
  // snaps about the center so a center-shrunk UTR stays on its row.
  float yTopPx = snapBoxTopPx(inst.y, inst.height, u.scrollY);
  float yBotPx = yTopPx + snapBoxHeightPx(inst.height);
  float syTop = yPxToClipY(yTopPx, u.canvasHeight);
  float syBot = yPxToClipY(yBotPx, u.canvasHeight);
  float sy = lerp(syBot, syTop, localY);

  float widthPx  = abs(span.y - span.x);
  float heightPx = abs(yBotPx - yTopPx);

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

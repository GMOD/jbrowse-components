// Multi-variant matrix renderer: one instance per cell (variant × sample).
// Each cell is a column by subpixel-precise row strip. A column at least 1px
// wide paints its pixels fully opaque (crisp seams, one pure cell color per
// pixel). A sub-pixel column (more variants than screen pixels) is still widened
// to MIN_COL_PX so it covers a pixel center and paints, but its alpha is scaled
// by its TRUE width fraction so dense regions blend lighter via the
// premultiplied-OVER blend — reproducing the canvas2d-in-worker sub-pixel AA on
// origin/main (a solid 1px-per-column fill looked noticeably darker). Overlapping
// widened columns accumulate OVER in feature order, the same as sequential
// canvas2d fillRects. Color is per-cell (not from a ramp) — the upstream worker
// picks an RGBA value per cell based on genotype/quality.
//! targets: wgsl, glsl

import colorPack;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;

// Minimum drawn column width in physical px, so sub-pixel columns (more variants
// than screen pixels) still cover a pixel center and paint.
static const float MIN_COL_PX = 1.0;

struct CellInstance {
  float featureIndex : ATTR0;
  uint  rowIndex     : ATTR1;
  uint  color        : ATTR2;
};

struct Uniforms {
  float numFeatures;
  float canvasWidth;
  float canvasHeight;
  float rowHeight;
  float scrollTop;
  float devicePixelRatio;
  // 1.0 when the view is horizontally flipped: draw data column i at mirrored
  // screen column (numFeatures-1-i) so columns track the reversed ruler and the
  // genome connector lines stop crossing. See LinesConnectingMatrixToGenomicPosition.
  float flipped;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position   : SV_Position;
  float4 color      : COLOR0;
  float2 xspan      : COLOR1;
  float  colWidthPx : COLOR2;
};

[shader("vertex")]
VsOut vs_main(CellInstance inst, uint vid : SV_VertexID) {
  float2 q = quadLocal(vid);
  float lx = q.x, ly = q.y;

  // Column edges in physical (framebuffer) pixels. canvasWidth is CSS pixels,
  // gl_FragCoord / @builtin(position) are physical, so scale by dpr to match.
  float widthPx = u.canvasWidth * u.devicePixelRatio;
  float col = u.flipped > 0.5 ? (u.numFeatures - 1.0 - inst.featureIndex)
                              : inst.featureIndex;
  float x1px = col / u.numFeatures * widthPx;
  float x2px = (col + 1.0) / u.numFeatures * widthPx;

  // True (pre-widening) column width in physical px. The fragment scales alpha
  // by clamp(this, 0, 1) so sub-pixel columns blend lighter (canvas2d-AA parity)
  // instead of painting a solid 1px column; >=1px columns stay fully opaque.
  float colWidthPx = x2px - x1px;

  // Widen sub-pixel columns to MIN_COL_PX (centered on their true center) so
  // they still cover a pixel center and paint. Wider columns keep true edges.
  if (x2px - x1px < MIN_COL_PX) {
    float center = (x1px + x2px) * 0.5;
    x1px = center - MIN_COL_PX * 0.5;
    x2px = center + MIN_COL_PX * 0.5;
  }

  // Expand the drawn quad out to whole physical pixels so every pixel whose
  // center falls in the span is rasterized; the fragment then keeps only the
  // pixel(s) whose center is actually inside the span (crisp opaque columns).
  float ex1 = floor(x1px);
  float ex2 = max(ceil(x2px), ex1 + 1.0);
  float clipX = lerp(ex1 / widthPx, ex2 / widthPx, lx) * 2.0 - 1.0;

  // Fractional y keeps subpixel rows smooth (no rounding = no discrete jumps
  // during resize); max(...,1) is the minimum quad height to avoid
  // GPU-culled zero-height geometry while preserving draw order for variant
  // priority.
  float yTop = float(inst.rowIndex) * u.rowHeight - u.scrollTop;
  float yBot = yTop + max(u.rowHeight, 1.0);
  float pxToClipY = 2.0 / u.canvasHeight;
  float clipY = lerp(1.0 - yBot * pxToClipY, 1.0 - yTop * pxToClipY, ly);

  VsOut o;
  o.position = float4(clipX, clipY, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.xspan = float2(x1px, x2px);
  o.colWidthPx = colWidthPx;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Crisp opaque columns: this pixel is painted only if its center falls inside
  // the column's span, so each pixel is a single pure cell color (no neighbor
  // blending). fragIn.position.x is the framebuffer pixel center (gl_FragCoord.x).
  float center = floor(fragIn.position.x) + 0.5;
  float inside = (center >= fragIn.xspan.x && center < fragIn.xspan.y) ? 1.0 : 0.0;
  // Sub-pixel columns contribute proportional coverage so dense regions blend
  // lighter (matches canvas2d AA); >=1px columns stay fully opaque.
  float cov = clamp(fragIn.colWidthPx, 0.0, 1.0);
  float a = fragIn.color.a * inside * cov;
  return float4(fragIn.color.rgb * a, a);
}

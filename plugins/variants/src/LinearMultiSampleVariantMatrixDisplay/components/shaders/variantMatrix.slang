// Multi-variant matrix renderer: one instance per cell (variant × sample).
// Each cell is a column by subpixel-precise row strip. Columns are narrower
// than a pixel when there are more variants than screen pixels, so the column
// is rasterized at whole-pixel granularity but its true (fractional) horizontal
// coverage is computed analytically in the fragment and carried in alpha. With
// the premultiplied OVER blend this reproduces the canvas2d coverage-composite
// look (smooth blended columns) instead of pixel-snapped opaque overwrite.
// Color is per-cell (not from a ramp) — the upstream worker picks an RGBA value
// per cell based on genotype/quality.
//! targets: wgsl, glsl

import colorPack;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;

// Left-edge overdraw in CSS px, mirroring `f2` in shared/constants.ts and the
// canvas2d fallback's fillRect(x - f2, ...). Columns overlap their left
// neighbor so premultiplied-OVER coverage composites back to ~full opacity (no
// washout) — the same trick the canvas2d / origin-main renderers use.
static const float OVERDRAW_CSS_PX = 0.3;

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
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 xspan    : COLOR1;
};

[shader("vertex")]
VsOut vs_main(CellInstance inst, uint vid : SV_VertexID) {
  float2 q = quadLocal(vid);
  float lx = q.x, ly = q.y;

  // Column edges in physical (framebuffer) pixels. canvasWidth is CSS pixels,
  // gl_FragCoord / @builtin(position) are physical, so scale by dpr to match.
  float widthPx = u.canvasWidth * u.devicePixelRatio;
  float x1px =
    inst.featureIndex / u.numFeatures * widthPx
    - OVERDRAW_CSS_PX * u.devicePixelRatio;
  float x2px = (inst.featureIndex + 1.0) / u.numFeatures * widthPx;

  // Expand the drawn quad out to whole physical pixels so every pixel the
  // column touches is fully rasterized — no sub-pixel column is dropped, and
  // MSAA sees full horizontal geometry coverage (the partial coverage lives in
  // alpha instead). Min one pixel wide keeps zero-width columns visible.
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
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Fraction of this physical pixel horizontally covered by the column's true
  // edges. fragIn.position.x is the framebuffer pixel center (gl_FragCoord.x).
  float px = floor(fragIn.position.x);
  float coverage = clamp(
    min(fragIn.xspan.y, px + 1.0) - max(fragIn.xspan.x, px),
    0.0,
    1.0);
  float a = fragIn.color.a * coverage;
  return float4(fragIn.color.rgb * a, a);
}

// Multi-variant matrix renderer: one instance per cell (variant × sample).
// Each cell is a pixel-snapped column by subpixel-precise row strip so that
// zooming / resizing doesn't cause discrete row jumps. Color is per-cell
// (not from a ramp) — the upstream worker picks an RGBA value per cell
// based on genotype/quality.
//! targets: wgsl, glsl

float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}

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
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(CellInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;
  float lx = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float ly = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;

  float x1 = inst.featureIndex / u.numFeatures;
  float x2 = (inst.featureIndex + 1.0) / u.numFeatures;
  float pxSizeX = 1.0 / u.canvasWidth;
  float cx1 = floor(x1 / pxSizeX + 0.5) * pxSizeX;
  float cx2 = max(floor(x2 / pxSizeX + 0.5) * pxSizeX, cx1 + pxSizeX);
  float clipX = lerp(cx1, cx2, lx) * 2.0 - 1.0;

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
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return float4(fragIn.color.rgb * fragIn.color.a, fragIn.color.a);
}

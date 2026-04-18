// Per-instance rectangle renderer for canvas feature glyphs.
//
// Uses vertex-attribute instancing on both backends (see ADR-005). The
// matching PassDescriptor must set `vertexBuffer: true`. Slang's WGSL output
// emits `@location(N)` vertex inputs that the WebGPU HAL wires up via
// vertex.buffers; Slang's GLSL output emits `in T a_field;` declarations
// that WebGL2 binds via `vertexAttribPointer` / `vertexAttribIPointer`.
//! targets: wgsl, glsl

import hpmath;
import colorPack;

// Mirrors sharedRendererConstants.MIN_RECT_WIDTH_PX (= 2).
static const float MIN_RECT_WIDTH_PX = 2.0;

struct RectInstance {
  uint2 startEnd : ATTR0;
  float y        : ATTR1;
  float height   : ATTR2;
  uint  color    : ATTR3;
};

struct Uniforms {
  float3 bpRangeX;
  uint   regionStart;
  float  canvasHeight;
  float  canvasWidth;
  float  scrollY;
  float  bpPerPx;
  float  zero;
  float  reversed;
};
// Binding 1 is the uniform across both the standard (storage+uniform) and
// uniform-only bind group layouts, so this binding annotation works under
// either HAL path. Binding 0 is left unused for vertex-buffer passes.
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(RectInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;
  float localX = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float localY = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;

  uint absStart = inst.startEnd.x + u.regionStart;
  uint absEnd   = inst.startEnd.y + u.regionStart;

  float sx1 = snapToPixelX(hpToClipX(hpSplitUint(absStart), u.bpRangeX, u.zero), u.canvasWidth);
  float sx2 = snapToPixelX(hpToClipX(hpSplitUint(absEnd),   u.bpRangeX, u.zero), u.canvasWidth);

  float minWidth = MIN_RECT_WIDTH_PX * 2.0 / u.canvasWidth;
  float dx = sx2 - sx1;
  if (abs(dx) < minWidth) {
    sx2 = sx1 + (dx < 0.0 ? -minWidth : minWidth);
  }
  float sx = lerp(sx1, sx2, localX);

  float yTopPx = floor(inst.y - u.scrollY + 0.5);
  float yBotPx = floor(yTopPx + inst.height + 0.5);
  float syTop = 1.0 - (yTopPx / u.canvasHeight) * 2.0;
  float syBot = 1.0 - (yBotPx / u.canvasHeight) * 2.0;
  float sy = lerp(syBot, syTop, localY);

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

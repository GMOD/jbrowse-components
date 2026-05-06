// Per-instance rectangle renderer for canvas feature glyphs.
//
// Uses vertex-attribute instancing on both backends (see ADR-005). The
// matching PassDescriptor must set `vertexBuffer: true`. Slang's WGSL output
// emits `@location(N)` vertex inputs that the WebGPU HAL wires up via
// vertex.buffers; Slang's GLSL output emits `in T a_field;` declarations
// that WebGL2 binds via `vertexAttribPointer` / `vertexAttribIPointer`.
//! targets: wgsl, glsl
//! export-consts: MIN_RECT_WIDTH_PX

import hpmath;
import colorPack;
import canvasUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
static const float MIN_RECT_WIDTH_PX = 2.0;

struct RectInstance {
  uint2 startEnd : ATTR0;
  float y        : ATTR1;
  float height   : ATTR2;
  uint  color    : ATTR3;
};

// Binding 1 is the uniform across both the standard (storage+uniform) and
// uniform-only bind group layouts, so this binding annotation works under
// either HAL path. Binding 0 is left unused for vertex-buffer passes.
[[vk::binding(1, 0)]] ConstantBuffer<CanvasUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  float2 featSizePx : TEXCOORD1;
};

[shader("vertex")]
VsOut vs_main(RectInstance inst, uint vid : SV_VertexID) {
  float2 q = quadLocal(vid);
  float localX = q.x, localY = q.y;

  float sx1 = snapToPixelX(hpToClipX(hpSplitUint(inst.startEnd.x), u.bpRangeX, u.zero), u.canvasWidth);
  float sx2 = snapToPixelX(hpToClipX(hpSplitUint(inst.startEnd.y), u.bpRangeX, u.zero), u.canvasWidth);

  float minWidth = MIN_RECT_WIDTH_PX * 2.0 / u.canvasWidth;
  float dx = sx2 - sx1;
  if (abs(dx) < minWidth) {
    sx2 = sx1 + (dx < 0.0 ? -minWidth : minWidth);
  }
  float sx = lerp(sx1, sx2, localX);

  float yTopPx = floor(inst.y - u.scrollY + 0.5);
  float yBotPx = floor(yTopPx + inst.height + 0.5);
  float syTop = yPxToClipY(yTopPx, u.canvasHeight);
  float syBot = yPxToClipY(yBotPx, u.canvasHeight);
  float sy = lerp(syBot, syTop, localY);

  float widthPx  = abs(sx2 - sx1) * u.canvasWidth * 0.5;
  float heightPx = abs(yBotPx - yTopPx);

  VsOut o;
  o.position   = float4(sx, sy, 0.0, 1.0);
  o.color      = unpackRGBA(inst.color);
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

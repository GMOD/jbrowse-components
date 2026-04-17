// Per-instance rectangle renderer for canvas feature glyphs.
//
// Uses a StructuredBuffer for instance data so the emitted WGSL matches the
// current HAL's storage-buffer-based instancing. GLSL output is not
// generated — WebGL2 has no SSBO, so the matching WebGL vertex shader
// stays hand-written in canvasGlslShaders.ts. A follow-up HAL change to
// support vertex-buffer attributes on WebGPU will let us drop the
// hand-written GLSL as well.
//! targets: wgsl

import hpmath;

// Mirrors sharedRendererConstants.MIN_RECT_WIDTH_PX (= 2).
static const float MIN_RECT_WIDTH_PX = 2.0;

float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}

// Field order matches the hand-written GLSL vertex attribute layout:
//   start_end (uvec2, 8B) | y (f32, 4B) | height (f32, 4B) | color (u32, 4B)
// Total 20 B — tight-packed. Avoids vec2u at the first slot so std430 element
// stride matches exactly (see the canvas hal alignment notes in ADR-005).
struct RectInstance {
  uint  start;
  uint  end;
  float y;
  float height;
  uint  color;
};

StructuredBuffer<RectInstance> instances;

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
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(uint vid : SV_VertexID, uint iid : SV_InstanceID) {
  RectInstance inst = instances[iid];

  uint v = vid % 6u;
  float localX = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float localY = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;

  uint absStart = inst.start + u.regionStart;
  uint absEnd   = inst.end + u.regionStart;

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

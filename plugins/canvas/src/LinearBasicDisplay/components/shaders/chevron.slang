// Directional chevrons rendered along the intron lines to indicate strand.
// Uses the same vertex buffer as line.slang (see lineInstance.slang). The
// renderer issues drawPass(chevron, region, bufferPassId=line) so the
// attribute layout here must stay identical to line's.
//
// One line produces up to MAX_VISIBLE_CHEVRONS_PER_LINE chevrons; each
// chevron is 2 triangles = 12 vertices dispatched via vertex ID. Per-
// chevron positioning is computed in the shader from viewport + line span.
//! targets: wgsl, glsl

import hpmath;
import lineInstance;

float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}

// Mirrors sharedRendererConstants.ts — kept as `static const` so Slang
// constant-folds the divisions into the vertex-shader math.
static const float CHEVRON_SPACING_PX = 25.0;
static const float CHEVRON_W_PX       = 4.5;
static const float CHEVRON_H_PX       = 4.5;

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
VsOut vs_main(LineInstance inst, uint vid : SV_VertexID) {
  int localChevronIndex = int(vid / 12u);
  uint v = vid % 12u;

  float lineLengthBp = float(inst.startEnd.y - inst.startEnd.x);
  float lineWidthPx = lineLengthBp / u.bpPerPx;

  VsOut o;
  o.position = float4(0.0);
  o.color = float4(0.0);

  if (inst.direction == 0.0 || lineWidthPx < CHEVRON_SPACING_PX * 0.5) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    return o;
  }

  int totalChevrons = max(1, int(floor(lineWidthPx / CHEVRON_SPACING_PX)));
  float bpSpacing = lineLengthBp / float(totalChevrons + 1);

  float vpBase = u.bpRangeX.x + u.bpRangeX.y - float(u.regionStart) - float(inst.startEnd.x);
  float vpOther = vpBase + u.bpRangeX.z;
  float viewportStartBp = min(vpBase, vpOther);
  float viewportEndBp = max(vpBase, vpOther);

  int firstVisible = max(0, int(floor(viewportStartBp / bpSpacing)) - 1);
  int lastVisible = min(totalChevrons - 1, int(ceil(viewportEndBp / bpSpacing)));

  int globalChevronIndex = firstVisible + localChevronIndex;
  if (globalChevronIndex < 0 || globalChevronIndex > lastVisible || globalChevronIndex >= totalChevrons) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    return o;
  }

  float chevronOffsetBp = bpSpacing * float(globalChevronIndex + 1);
  uint lineStartAbs = inst.startEnd.x + u.regionStart;
  float2 splitStart = hpSplitUint(lineStartAbs);
  float2 splitChevron = float2(splitStart.x, splitStart.y + chevronOffsetBp);
  float cx = hpToClipX(splitChevron, u.bpRangeX, u.zero);

  float yPx = floor(inst.y - u.scrollY + 0.5) + 0.5;
  float cy = 1.0 - (yPx / u.canvasHeight) * 2.0;

  float halfW = CHEVRON_W_PX / u.canvasWidth;
  float halfH = CHEVRON_H_PX / u.canvasHeight;
  float thickness = 1.5 / u.canvasHeight;
  float dir = lerp(inst.direction, -inst.direction, u.reversed);

  bool isTopArm = v < 6u;
  uint qv = v % 6u;

  float tipX = cx + halfW * dir;
  float outerX = cx - halfW * dir;
  float armY = isTopArm ? halfH : -halfH;

  float sx;
  float sy;
  switch (qv) {
    case 0u: sx = outerX; sy = cy + armY;                                        break;
    case 1u: sx = tipX;   sy = cy + thickness * 0.5;                             break;
    case 2u: sx = tipX;   sy = cy - thickness * 0.5;                             break;
    case 3u: sx = outerX; sy = cy + armY;                                        break;
    case 4u: sx = tipX;   sy = cy - thickness * 0.5;                             break;
    default: sx = outerX; sy = cy + armY - (isTopArm ? thickness : -thickness);  break;
  }

  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}

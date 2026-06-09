// Directional chevrons rendered along the intron lines to indicate strand.
// Uses the same vertex buffer as line.slang (see lineInstance.slang). The
// renderer issues drawPass(chevron, region, bufferPassId=line) so the
// attribute layout here must stay identical to line's.
//
// One line produces up to MAX_VISIBLE_CHEVRONS_PER_LINE chevrons; each
// chevron is 2 triangles = 12 vertices dispatched via vertex ID. Per-
// chevron positioning is computed in the shader from viewport + line span.
//! targets: wgsl, glsl
//! export-consts: CHEVRON_SPACING_PX, CHEVRON_W_PX, CHEVRON_H_PX, CHEVRON_THICKNESS_PX

import hpmath;
import colorPack;
import lineInstance;
import featureGlyphUniforms;

static const float CHEVRON_SPACING_PX  = 40.0;
static const float CHEVRON_W_PX        = 4.0;
static const float CHEVRON_H_PX        = 4.0;
static const float CHEVRON_THICKNESS_PX = 0.5;

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float  dist     : TEXCOORD0;
};

// Off-clip vertex; the GPU culls any triangle that contains it.
static const float4 OFFSCREEN = float4(2.0, 2.0, 0.0, 1.0);

[shader("vertex")]
VsOut vs_main(LineInstance inst, uint vid : SV_VertexID) {
  int localChevronIndex = int(vid / 12u);
  uint v = vid % 12u;

  float lineLengthBp = float(inst.startEnd.y - inst.startEnd.x);
  float lineWidthPx = lineLengthBp / u.bpPerPx;

  VsOut o;
  o.position = float4(0.0);
  o.color = float4(0.0);
  o.dist = 0.0;

  if (inst.direction == 0.0 || lineWidthPx < CHEVRON_SPACING_PX * 0.5) {
    o.position = OFFSCREEN;
    return o;
  }

  int totalChevrons = max(1, int(floor(lineWidthPx / CHEVRON_SPACING_PX)));
  float bpSpacing = lineLengthBp / float(totalChevrons + 1);

  float2 splitLine = hpSplitUint(inst.startEnd.x);
  float viewStartFromLine = hpViewportOffsetBp(splitLine, u.bpRangeX);
  float viewEndFromLine = viewStartFromLine + u.bpRangeX.z;
  float viewportStartBp = min(viewStartFromLine, viewEndFromLine);
  float viewportEndBp   = max(viewStartFromLine, viewEndFromLine);

  int firstVisible = max(0, int(floor(viewportStartBp / bpSpacing)) - 1);
  int lastVisible = min(totalChevrons - 1, int(ceil(viewportEndBp / bpSpacing)));

  int globalChevronIndex = firstVisible + localChevronIndex;
  if (globalChevronIndex < 0 || globalChevronIndex > lastVisible || globalChevronIndex >= totalChevrons) {
    o.position = OFFSCREEN;
    return o;
  }

  float chevronOffsetBp = bpSpacing * float(globalChevronIndex + 1);
  float2 splitChevron = float2(splitLine.x, splitLine.y + chevronOffsetBp);
  float cx = hpClipX(splitChevron, u);

  float cy = snapPixelCenterY(inst.y, u.scrollY, u.canvasHeight);

  float halfW = CHEVRON_W_PX / u.canvasWidth;
  float halfH = CHEVRON_H_PX / u.canvasHeight;
  // Extrude geometry 1px per side for fwidth-based AA in the fragment.
  float coreHalfThickness = CHEVRON_THICKNESS_PX / u.canvasHeight;
  float aaPad = 2.0 / u.canvasHeight;
  float extHalfThickness = coreHalfThickness + aaPad;
  // Perpendicular-pixel-distance carried by `dist` varying.
  float armHalfPx = CHEVRON_THICKNESS_PX * 0.5 + 1.0;
  float dir = flipX(inst.direction, u);

  bool isTopArm = v < 6u;
  uint qv = v % 6u;

  float tipX = cx + halfW * dir;
  float outerX = cx - halfW * dir;
  float armY = isTopArm ? halfH : -halfH;

  float sx;
  float sy;
  switch (qv) {
    case 0u: sx = outerX; sy = cy + armY + (isTopArm ? aaPad : -aaPad);                                  break;
    case 1u: sx = tipX;   sy = cy + extHalfThickness;                                                    break;
    case 2u: sx = tipX;   sy = cy - extHalfThickness;                                                    break;
    case 3u: sx = outerX; sy = cy + armY + (isTopArm ? aaPad : -aaPad);                                  break;
    case 4u: sx = tipX;   sy = cy - extHalfThickness;                                                    break;
    default: sx = outerX; sy = cy + armY + (isTopArm ? -(2.0*coreHalfThickness+aaPad) : (2.0*coreHalfThickness+aaPad)); break;
  }

  float d = isTopArm
    ? ((qv == 0u || qv == 1u || qv == 3u) ? armHalfPx : -armHalfPx)
    : ((qv == 1u || qv == 5u)             ? armHalfPx : -armHalfPx);

  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.dist = d;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float coreHalfPx = CHEVRON_THICKNESS_PX * 0.5;
  float alpha = clamp((coreHalfPx - abs(fragIn.dist)) / fwidth(fragIn.dist) + 0.5, 0.0, 1.0);
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

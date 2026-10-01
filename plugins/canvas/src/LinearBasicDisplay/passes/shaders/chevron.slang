// Strand chevrons along intron lines, drawn from line's vertex buffer
// (lineInstance.slang). Each instance is one line and covers up to the pass's
// per-line chevron budget; the vertex ID picks the chevron and its arm, and the
// shader places each chevron from the viewport and the line span.
//! targets: wgsl, glsl
//! export-consts: CHEVRON_SPACING_PX, CHEVRON_W_PX, CHEVRON_H_PX, CHEVRON_THICKNESS_PX, CHEVRON_VERTS
//! js-export: showChevrons, chevronCount, chevronOffset, chevronFirstVisible, chevronLastVisible

import antialias;
import hpmath;
import colorPack;
import lineInstance;
import featureGlyphUniforms;

static const float CHEVRON_SPACING_PX  = 40.0;
static const float CHEVRON_W_PX        = 4.0;
static const float CHEVRON_H_PX        = 4.0;
static const float CHEVRON_THICKNESS_PX = 1.0;

// Two 6-vertex quad arms per chevron. The pass's per-instance vertex count is
// CHEVRON_VERTS times the renderer's per-line chevron budget, hence the export.
static const uint CHEVRON_ARM_VERTS = 6u;
static const uint CHEVRON_VERTS = CHEVRON_ARM_VERTS * 2u;

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float  dist     : TEXCOORD0;
};

// Off-clip vertex; the GPU culls any triangle that contains it.
static const float4 OFFSCREEN = float4(2.0, 2.0, 0.0, 1.0);

// Chevron layout along a line, js-exported so Canvas2D places chevrons where
// this shader does (adr-051). The shader measures the line in bp and Canvas2D
// in px, so these take either unit, except `showChevrons` and `chevronCount`,
// whose thresholds are px.

// A line shorter than half the spacing gets no chevron, rather than one crammed
// against its ends.
public bool showChevrons(float lineWidthPx) {
  return lineWidthPx >= CHEVRON_SPACING_PX * 0.5;
}

// At least one. A float, so it feeds `chevronOffset` without a second rounding;
// each backend truncates it to an index where it iterates.
public float chevronCount(float lineWidthPx) {
  return max(1.0, floor(lineWidthPx / CHEVRON_SPACING_PX));
}

// Distance from the line's start to chevron `index`, in `span`'s unit. N
// chevrons sit in N+1 equal gaps, so neither end is flush.
public float chevronOffset(float span, float count, float index) {
  return span / (count + 1.0) * (index + 1.0);
}

// First and last index of the chevrons that can put ink on screen, given the
// viewport measured from the line's start and a chevron's half-width `reach`,
// all in `spacing`'s unit. Chevron `i` sits at `spacing * (i + 1)`, and
// widening by `reach` keeps one whose arms straddle the viewport edge. Last
// below first means the line is entirely off screen.
public float chevronFirstVisible(float viewportStart, float spacing, float reach) {
  return max(0.0, ceil((viewportStart - reach) / spacing - 1.0));
}

public float chevronLastVisible(float viewportEnd, float spacing, float count, float reach) {
  return min(count - 1.0, floor((viewportEnd + reach) / spacing - 1.0));
}

[shader("vertex")]
VsOut vs_main(LineInstance inst, uint vid : SV_VertexID) {
  int localChevronIndex = int(vid / CHEVRON_VERTS);
  uint v = vid % CHEVRON_VERTS;

  float lineLengthBp = float(inst.startEnd.y - inst.startEnd.x);
  float lineWidthPx = lineLengthBp / u.bpPerPx;

  // The OFFSCREEN early-outs never read these; the drawn path overwrites both.
  VsOut o;
  o.color = float4(0.0);
  o.dist = 0.0;

  if (inst.direction == 0.0 || !showChevrons(lineWidthPx)) {
    o.position = OFFSCREEN;
    return o;
  }

  float chevronsPerLine = chevronCount(lineWidthPx);
  float bpSpacing = chevronOffset(lineLengthBp, chevronsPerLine, 0.0);

  float2 splitLine = hpSplitUint(inst.startEnd.x);
  float viewStartFromLine = hpOffsetBp(splitLine, u);
  float viewEndFromLine = viewStartFromLine + u.bpRangeX.z;
  float viewportStartBp = min(viewStartFromLine, viewEndFromLine);
  float viewportEndBp   = max(viewStartFromLine, viewEndFromLine);

  // The window is in bp, so the arms' px reach converts too.
  float reachBp = CHEVRON_W_PX * 0.5 * u.bpPerPx;
  int firstVisible =
    int(chevronFirstVisible(viewportStartBp, bpSpacing, reachBp));
  int lastVisible =
    int(chevronLastVisible(viewportEndBp, bpSpacing, chevronsPerLine, reachBp));

  int globalChevronIndex = firstVisible + localChevronIndex;
  if (globalChevronIndex > lastVisible) {
    o.position = OFFSCREEN;
    return o;
  }

  float chevronOffsetBp =
    chevronOffset(lineLengthBp, chevronsPerLine, float(globalChevronIndex));
  float cx = hpClipX(hpAddBp(splitLine, chevronOffsetBp), u);

  float cy = snapBoxCenterY(inst.y, u.scrollY, u.canvasHeight);

  float halfW = pxToClipW(CHEVRON_W_PX * 0.5, u);
  float halfH = pxToClipH(CHEVRON_H_PX * 0.5, u);
  // Extrude geometry 1px per side so the fragment's AA ramp has room.
  float coreHalfThickness = pxToClipH(CHEVRON_THICKNESS_PX * 0.5, u);
  float aaPad = pxToClipH(1.0, u);
  float extHalfThickness = coreHalfThickness + aaPad;
  // `dist` is the signed vertical px offset from the arm's centerline, so the
  // extruded edges sit at ±armHalfPx.
  float armHalfPx = CHEVRON_THICKNESS_PX * 0.5 + 1.0;
  float dir = flipX(inst.direction, u);

  bool isTopArm = v < CHEVRON_ARM_VERTS;
  uint qv = v % CHEVRON_ARM_VERTS;

  float tipX = cx + halfW * dir;
  float outerX = cx - halfW * dir;
  float armY = isTopArm ? halfH : -halfH;

  float sx;
  float sy;
  // Tip on `cy`, outer end on `cy + armY`, where the Canvas2D path strokes it.
  float outerSide = isTopArm ? extHalfThickness : -extHalfThickness;
  switch (qv) {
    case 0u: sx = outerX; sy = cy + armY + outerSide; break;
    case 1u: sx = tipX;   sy = cy + extHalfThickness; break;
    case 2u: sx = tipX;   sy = cy - extHalfThickness; break;
    case 3u: sx = outerX; sy = cy + armY + outerSide; break;
    case 4u: sx = tipX;   sy = cy - extHalfThickness; break;
    default: sx = outerX; sy = cy + armY - outerSide; break;
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
  // `dist` is a vertical offset, not a perpendicular distance, so the ramp width
  // is measured with `aaGradient`. On these slanted arms `fwidth` overstates the
  // gradient by a third and would wash the chevrons out.
  float coreHalfPx = CHEVRON_THICKNESS_PX * 0.5;
  float alpha =
    aaRamp(coreHalfPx - abs(fragIn.dist), aaGradient(fragIn.dist));
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

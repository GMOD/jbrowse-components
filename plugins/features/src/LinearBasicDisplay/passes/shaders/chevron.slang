// Strand chevrons along intron lines, drawn from line's vertex buffer
// (lineInstance.slang). Each instance is one line and covers as many chevrons
// as the draw asks for; the vertex ID picks the chevron and its corner, and the
// shader places each chevron from the viewport and the line span.
//! targets: wgsl, glsl
//! coverage: analytic
//! export-consts: CHEVRON_SPACING_PX, CHEVRON_W_PX, CHEVRON_H_PX, CHEVRON_THICKNESS_PX, CHEVRON_VERTS
//! js-export: showChevrons, chevronCount, chevronOffset, chevronFirstVisible, chevronLastVisible

import hpmath;
import colorPack;
import lineInstance;
import featureGlyphUniforms;
import chevronStroke;

static const float CHEVRON_SPACING_PX  = 40.0;
static const float CHEVRON_W_PX        = 4.0;
static const float CHEVRON_H_PX        = 4.0;
static const float CHEVRON_THICKNESS_PX = 1.0;

// One triangle per chevron (chevronStroke.slang). The pass registers one
// chevron's worth; each draw asks for CHEVRON_VERTS times the slots it can fill
// (`chevronDrawSlots`), hence the export.
static const uint CHEVRON_VERTS = 3u;
public static const uint VERTS_PER_INSTANCE = CHEVRON_VERTS;

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float4 local    : TEXCOORD0;
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
  o.local = float4(0.0);

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
  float dir = flipX(inst.direction, u);
  // Canvas2D centres the chevron on its offset, so the apex is half a width on.
  float apexX = cx + pxToClipW(CHEVRON_W_PX * 0.5, u) * dir;
  ChevronCorner c = chevronCorner(
    v, CHEVRON_W_PX, CHEVRON_H_PX * 0.5, CHEVRON_THICKNESS_PX * 0.5,
    u.devicePixelRatio);

  o.position = float4(
    apexX + pxToClipW(c.offsetPx.x, u) * dir,
    cy + pxToClipH(c.offsetPx.y, u), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.local = c.local;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float alpha = chevronCoverage(
    fragIn.local, CHEVRON_THICKNESS_PX * 0.5, u.devicePixelRatio);
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}

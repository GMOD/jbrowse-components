// Strand chevrons along intron lines, drawn from line's vertex buffer
// (lineInstance.slang). Each instance is one line and covers as many chevrons
// as the draw asks for; the vertex ID picks the chevron and its corner, and the
// shader places each chevron on the genome grid inside the viewport and the
// line span, sized to the line's box.
//! targets: wgsl, glsl
//! coverage: analytic
//! export-consts: CHEVRON_SPACING_PX, CHEVRON_W_PX, CHEVRON_H_PX, CHEVRON_THICKNESS_PX, CHEVRON_END_GAP_PX, CHEVRON_VERTS
//! js-export: chevronGridBp, chevronPhaseBp, chevronHalfHeightPx, chevronFirstIndex, chevronLastIndex

import hpmath;
import colorPack;
import lineInstance;
import featureGlyphUniforms;
import chevronStroke;

// The grid step is the smallest power of two in bp at least this far apart on
// screen, so the gap runs from this to twice it and averages about 40 px. Not a
// power of two, so no step boundary falls on a round bpPerPx.
static const float CHEVRON_SPACING_PX  = 28.0;
static const float CHEVRON_W_PX        = 4.0;
static const float CHEVRON_H_PX        = 4.0;
static const float CHEVRON_THICKNESS_PX = 1.0;
// A chevron shorter than this reads as a dash, so a box with no room for it
// gets none.
static const float CHEVRON_MIN_HALF_H_PX = 1.0;
// Room kept clear between a chevron's arms and the exon either end of its line.
static const float CHEVRON_END_GAP_PX = 2.0;

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

// Chevron layout, js-exported so Canvas2D places chevrons where this shader
// does (adr-051). Chevrons sit on one genome-wide grid rather than spread along
// each line, so the isoforms of a gene stack theirs in columns, and a zoom
// halves or doubles the grid instead of re-spreading every line's chevrons.

public float chevronGridBp(float bpPerPx) {
  return pow(2.0, ceil(log2(CHEVRON_SPACING_PX * bpPerPx)));
}

// Flattened until its stroke fits inside its own box, so a compact row's
// chevrons never reach the rows beside it; 0 where even the flattest would not.
public float chevronHalfHeightPx(float boxHeightPx) {
  float half =
    min(CHEVRON_H_PX, boxHeightPx - CHEVRON_THICKNESS_PX) * 0.5;
  return half < CHEVRON_MIN_HALF_H_PX ? 0.0 : half;
}

// First and last grid index whose chevron lands inside [lo, hi], measured from
// the line's start; grid point `k` sits at `phase + k * grid`. Last below first
// means none does.
public float chevronFirstIndex(float lo, float phase, float grid) {
  return max(0.0, ceil((lo - phase) / grid));
}

public float chevronLastIndex(float hi, float phase, float grid) {
  return floor((hi - phase) / grid);
}

// From the line's start to the first grid point at or after it. A grid of one
// bp or less has every integer start on it; a coarser one is a power of two, so
// the remainder is a mask, exact where a float32 modulo of a 3e9 bp start is
// not.
public float chevronPhaseBp(uint startBp, float gridBp) {
  if (gridBp <= 1.0) {
    return 0.0;
  }
  if (gridBp >= 4294967296.0) {
    return gridBp - float(startBp);
  }
  uint grid = uint(gridBp + 0.5);
  uint rem = startBp & (grid - 1u);
  return rem == 0u ? 0.0 : float(grid - rem);
}

[shader("vertex")]
VsOut vs_main(LineInstance inst, uint vid : SV_VertexID) {
  int localChevronIndex = int(vid / CHEVRON_VERTS);
  uint v = vid % CHEVRON_VERTS;

  float halfH = chevronHalfHeightPx(inst.height);

  // The OFFSCREEN early-outs never read these; the drawn path overwrites both.
  VsOut o;
  o.color = float4(0.0);
  o.local = float4(0.0);

  if (inst.direction == 0.0 || halfH == 0.0) {
    o.position = OFFSCREEN;
    return o;
  }

  float halfW = CHEVRON_W_PX * 0.5;
  float lineLengthBp = float(inst.startEnd.y - inst.startEnd.x);
  float gridBp = chevronGridBp(u.bpPerPx);
  float phaseBp = chevronPhaseBp(inst.startEnd.x, gridBp);

  float2 splitLine = hpSplitUint(inst.startEnd.x);
  float viewStartFromLine = hpOffsetBp(splitLine, u);
  float viewEndFromLine = viewStartFromLine + u.bpRangeX.z;
  float viewportStartBp = min(viewStartFromLine, viewEndFromLine);
  float viewportEndBp   = max(viewStartFromLine, viewEndFromLine);

  // The window is in bp, so the arms' px reach converts too.
  float reachBp = halfW * u.bpPerPx;
  float marginBp = (halfW + CHEVRON_END_GAP_PX) * u.bpPerPx;
  int firstIndex = int(chevronFirstIndex(
    max(marginBp, viewportStartBp - reachBp), phaseBp, gridBp));
  int lastIndex = int(chevronLastIndex(
    min(lineLengthBp - marginBp, viewportEndBp + reachBp), phaseBp, gridBp));

  int gridIndex = firstIndex + localChevronIndex;
  if (gridIndex > lastIndex) {
    o.position = OFFSCREEN;
    return o;
  }

  float chevronOffsetBp = phaseBp + float(gridIndex) * gridBp;
  float cx = hpClipX(hpAddBp(splitLine, chevronOffsetBp), u);

  float cy = snapBoxCenterY(inst.y, u.scrollY, u.canvasHeight);
  float dir = flipX(inst.direction, u);
  // Canvas2D centres the chevron on its offset, so the apex is half a width on.
  float apexX = cx + pxToClipW(halfW, u) * dir;
  ChevronCorner c = chevronCorner(
    v, CHEVRON_W_PX, halfH, CHEVRON_THICKNESS_PX * 0.5, u.devicePixelRatio);

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

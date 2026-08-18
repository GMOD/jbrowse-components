// Directional chevrons rendered along the intron lines to indicate strand.
// Uses the same vertex buffer as line.slang (see lineInstance.slang). The
// renderer issues drawPass(chevron, region, bufferPassId=line) so the
// attribute layout here must stay identical to line's.
//
// One line produces up to MAX_VISIBLE_CHEVRONS_PER_LINE chevrons; each
// chevron is two arms of CHEVRON_ARM_VERTS each, dispatched via vertex ID.
// Per-chevron positioning is computed in the shader from viewport + line span.
//! targets: wgsl, glsl
//! export-consts: CHEVRON_SPACING_PX, CHEVRON_W_PX, CHEVRON_H_PX, CHEVRON_THICKNESS_PX, CHEVRON_VERTS
//! js-export: showChevrons, chevronCount, chevronOffset, chevronFirstVisible, chevronLastVisible

import hpmath;
import colorPack;
import lineInstance;
import featureGlyphUniforms;

static const float CHEVRON_SPACING_PX  = 40.0;
static const float CHEVRON_W_PX        = 4.0;
static const float CHEVRON_H_PX        = 4.0;
static const float CHEVRON_THICKNESS_PX = 0.5;

// One chevron is two arms, each an ordinary 6-vertex quad (2 triangles), so
// `vs_main` splits `SV_VertexID` by both numbers below. The pass's per-instance
// vertex count is CHEVRON_VERTS times the renderer's own cap on chevrons per
// line, which is why this is `export-consts`ed rather than left a literal:
// `makeChevronPass` was spelling the 12 a second time, and neither copy could
// see the other.
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

// How a line's chevrons are laid out along it. The three decisions below are
// the whole of it, and both backends have to answer them identically or the
// strand marks land in different places on a GPU machine and a Canvas2D one —
// which nothing would catch, because each looks plausible alone. They were
// stated inline here and again in Canvas2DFeatureRenderer's `drawLines` until
// adr-051; `//! js-export` now generates that second copy.
//
// Deliberately unit-agnostic: this shader measures the line in bp (it has an
// hp-split start to add an offset to) and Canvas2D measures it in px. Only
// `showChevrons` and `chevronCount` are px, because the thresholds they compare
// against are.

// Whether a line hosts chevrons at all. Too short to fit one with reasonable
// margins (half the nominal spacing) and it gets none, rather than one crammed
// against its ends.
public bool showChevrons(float lineWidthPx) {
  return lineWidthPx >= CHEVRON_SPACING_PX * 0.5;
}

// How many, at least one for any line that clears `showChevrons`. Float rather
// than int so the count can be multiplied straight back into `chevronOffset`
// without either backend rounding it a second time; both truncate it to an
// index type at the point they iterate.
public float chevronCount(float lineWidthPx) {
  return max(1.0, floor(lineWidthPx / CHEVRON_SPACING_PX));
}

// Distance from the line's start to chevron `index`, in whatever unit `span` is.
// N chevrons sit in N+1 evenly-sized gaps, so neither end is flush — both `+1`s
// are here, once, instead of being spelled on each side.
public float chevronOffset(float span, float count, float index) {
  return span / (count + 1.0) * (index + 1.0);
}

// Which chevron indices can put ink on screen: the first and last of the
// inclusive window, given the viewport measured from the LINE'S START and the
// chevron's own half-width, both in whatever unit `spacing` is. Empty when the
// last comes out below the first, which is a line entirely off screen.
//
// `chevronOffset` solved for the index, then widened by `reach`: chevron `i`
// sits at `spacing * (i + 1)`, so it is on screen when
// `spacing * (i + 1) + reach >= viewportStart` and
// `spacing * (i + 1) - reach <= viewportEnd`.
//
// The window is over the chevron's ARMS, not its centre, and that is the whole
// reason this is a function. Both backends had written it out inline — the
// shader here in bp, `drawLines` in px — and only the GPU's copy allowed for the
// arms (by padding a whole spacing at each end, which is also why the vertex
// budget below covers less block than it looks like it should). A chevron
// straddling the viewport edge therefore drew on the GPU and vanished on
// Canvas2D and in the SVG export. The three decisions above were lifted out of
// `vs_main` for exactly this reason and this one was left behind, where nothing
// that inventories shader FUNCTIONS could see it.
//
// Two scalars rather than one pair: the two ends share no branch, so splitting
// them costs neither backend a recomputation (contrast `rectSpanPx`, where the
// right edge is defined in terms of the left).
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

  // color/dist are seeded for the OFFSCREEN early-outs below, whose culled
  // triangles never read a varying; the drawn path overwrites both.
  VsOut o;
  o.color = float4(0.0);
  o.dist = 0.0;

  if (inst.direction == 0.0 || !showChevrons(lineWidthPx)) {
    o.position = OFFSCREEN;
    return o;
  }

  float chevronsPerLine = chevronCount(lineWidthPx);
  int totalChevrons = int(chevronsPerLine);
  float bpSpacing = chevronOffset(lineLengthBp, chevronsPerLine, 0.0);

  float2 splitLine = hpSplitUint(inst.startEnd.x);
  float viewStartFromLine = hpViewportOffsetBp(splitLine, u.bpRangeX);
  float viewEndFromLine = viewStartFromLine + u.bpRangeX.z;
  float viewportStartBp = min(viewStartFromLine, viewEndFromLine);
  float viewportEndBp   = max(viewStartFromLine, viewEndFromLine);

  // The arms reach CHEVRON_W_PX * 0.5 SCREEN px to each side of the centre, and
  // this window is measured in bp — so the reach converts, exactly as
  // lineWidthPx above converts the other way. Both terms of `chevronFirstVisible`
  // must be in one unit or the widening is meaningless.
  float reachBp = CHEVRON_W_PX * 0.5 * u.bpPerPx;
  int firstVisible =
    int(chevronFirstVisible(viewportStartBp, bpSpacing, reachBp));
  int lastVisible =
    int(chevronLastVisible(viewportEndBp, bpSpacing, chevronsPerLine, reachBp));

  int globalChevronIndex = firstVisible + localChevronIndex;
  if (globalChevronIndex < 0 || globalChevronIndex > lastVisible || globalChevronIndex >= totalChevrons) {
    o.position = OFFSCREEN;
    return o;
  }

  float chevronOffsetBp =
    chevronOffset(lineLengthBp, chevronsPerLine, float(globalChevronIndex));
  float2 splitChevron = float2(splitLine.x, splitLine.y + chevronOffsetBp);
  float cx = hpClipX(splitChevron, u);

  float cy = snapBoxCenterY(inst.y, inst.height, u.scrollY, u.canvasHeight);

  float halfW = pxToClipW(CHEVRON_W_PX * 0.5, u);
  float halfH = pxToClipH(CHEVRON_H_PX * 0.5, u);
  // Extrude geometry 1px per side for fwidth-based AA in the fragment.
  float coreHalfThickness = pxToClipH(CHEVRON_THICKNESS_PX * 0.5, u);
  float aaPad = pxToClipH(1.0, u);
  float extHalfThickness = coreHalfThickness + aaPad;
  // Half-extent of the `dist` varying: signed *vertical* px offset from the
  // arm's centerline, ±(core half-thickness + aaPad). The fragment's fwidth
  // divide converts it to a screen-space distance, which folds in the arm's
  // slant, so the drawn arm lands within a few hundredths of a px of the
  // Canvas2D path's CHEVRON_THICKNESS_PX stroke.
  float armHalfPx = CHEVRON_THICKNESS_PX * 0.5 + 1.0;
  float dir = flipX(inst.direction, u);

  bool isTopArm = v < CHEVRON_ARM_VERTS;
  uint qv = v % CHEVRON_ARM_VERTS;

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

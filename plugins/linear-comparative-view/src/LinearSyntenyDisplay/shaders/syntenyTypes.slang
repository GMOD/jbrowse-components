// Shared per-instance layout + uniform block for fill/edge synteny shaders.
// Each instance is one parallelogram (or one curved ribbon strip): four
// corner positions in cumulative-bp space (split hi/lo for hp-math precision).
// Corners 1/2 belong to the top view (view 0), corners 3/4 to the bottom view
// (view 1).
//
// Curve mode and straight-line mode live in separate shader files
// (syntenyFill{Curve,Straight}.slang, syntenyEdge{Curve,Straight}.slang) so
// there are no `isCurve` branches anywhere; `GpuSyntenyRenderer.render`
// dispatches the appropriate pass per track. This module is mode-agnostic.
module syntenyTypes;

import hpmath;

public struct Instance {
  public float bp1Hi : ATTR0;
  public float bp1Lo : ATTR1;
  public float bp2Hi : ATTR2;
  public float bp2Lo : ATTR3;
  public float bp3Hi : ATTR4;
  public float bp3Lo : ATTR5;
  public float bp4Hi : ATTR6;
  public float bp4Lo : ATTR7;
  public uint  color             : ATTR8;
  public float featureId         : ATTR9;
  public float alignmentLength   : ATTR10;
  // Per-instance KIND tag (KIND_BASE/KIND_CIGAR_*/etc from syntenyColors.ts).
  // Used by the fill fragment to decide whether perpendicular AA should be
  // smooth (BASE — outer feature silhouette) or hard-cut (CIGAR — tiles a
  // feature, so smoothstep at shared edges with sibling CIGAR instances
  // bleeds background through the seam under standard alpha blend).
  public float kind              : ATTR11;
};

// First CIGAR kind. Kinds 0..2 are whole-feature (KIND_BASE/BASE_HIDDEN/MARKER);
// kinds >= 3 are per-CIGAR tiles (KIND_CIGAR_MATCH/I/D/N/HIDDEN). The shaders
// only need the BASE-vs-CIGAR split, not the exact kind.
// SYNC: mirrors KIND_CIGAR_MATCH (=3) in LinearSyntenyRPC/syntenyColors.ts; the
// whole CIGAR range must stay contiguous and above the non-CIGAR kinds.
public static const float KIND_CIGAR_MIN = 3.0;

// A CIGAR tile shares slanted edges with sibling tiles of the same feature, so
// it needs hard-cut perpendicular coverage (no smoothstep) to tile cleanly;
// whole-feature BASE instances get full silhouette AA.
public bool isCigarKind(float kind) { return kind >= KIND_CIGAR_MIN; }

// KIND_MARKER (=2 in syntenyColors.ts): a periodic "location marker" tick — a
// zero-width vertical line emitted across large matches for visual context.
// Rendered as a fixed 1px line at its own packed alpha, not subject to the
// sub-pixel width fade (which would zero a zero-width quad) or global alpha.
public static const float KIND_MARKER = 2.0;
public bool isMarkerKind(float kind) { return abs(kind - KIND_MARKER) < 0.5; }

// Floor for the density-honest sub-pixel fade below (widthFade). Without a
// floor, a whole-genome view with no minAlignmentLength filter (e.g. a raw
// minimap2 PAF) is almost entirely sub-pixel-thin, so every ribbon fades
// toward zero and overlap accumulation never catches up — the view goes
// nearly blank instead of merely de-emphasized. Keeps a single thin ribbon
// faintly locatable; dense overlaps still read brighter via alpha blend.
public static const float WIDTH_FADE_FLOOR = 0.15;

// Per-view hp-math origin (`viewBp = offsetPx * bpPerPx`, hi/lo split) +
// `bpPerPxInv`. The view origin reconstructs LGV-aligned screen positions
// directly (math derivation in hpCornerScreenX). `hpZero` is the sentinel
// passed through to hpmath helpers (always 0 from JS).
public struct Uniforms {
  public float2 resolution;
  public float  height;
  public float  viewBp0Hi;
  public float  viewBp0Lo;
  public float  bpPerPxInv0;
  public float  viewBp1Hi;
  public float  viewBp1Lo;
  public float  bpPerPxInv1;
  public float  hpZero;
  public float  overdrawPx;
  public float  minAlignmentLength;
  public float  alpha;
  public float  hoveredFeatureId;
  public float  clickedFeatureId;
  public float  yTop;
  public float  fadeThinAlignments;
};

public struct Corners {
  public float x1, x2, x3, x4;
};

public Corners computeCorners(Instance inst, Uniforms u) {
  Corners c;
  c.x1 = hpCornerScreenX(inst.bp1Hi, inst.bp1Lo, u.viewBp0Hi, u.viewBp0Lo,
                         u.bpPerPxInv0, u.hpZero);
  c.x2 = hpCornerScreenX(inst.bp2Hi, inst.bp2Lo, u.viewBp0Hi, u.viewBp0Lo,
                         u.bpPerPxInv0, u.hpZero);
  c.x3 = hpCornerScreenX(inst.bp3Hi, inst.bp3Lo, u.viewBp1Hi, u.viewBp1Lo,
                         u.bpPerPxInv1, u.hpZero);
  c.x4 = hpCornerScreenX(inst.bp4Hi, inst.bp4Lo, u.viewBp1Hi, u.viewBp1Lo,
                         u.bpPerPxInv1, u.hpZero);
  return c;
}

public bool isCulled(Corners c, float alignmentLength, Uniforms u) {
  if (u.minAlignmentLength > 0.0 && alignmentLength < u.minAlignmentLength) {
    return true;
  }
  float mOff = u.overdrawPx;
  float rW = u.resolution.x;
  return max(c.x1, c.x2) < -mOff || min(c.x1, c.x2) > rW + mOff
      || max(c.x3, c.x4) < -mOff || min(c.x3, c.x4) > rW + mOff;
}

// Ease-in-out ribbon basis (single source of truth). Curve mode traces y(t) =
// height·yCurve(t) vertically and blends edge X by sBlend(t); the fill-curve
// fragment inverts yCurve via Newton using yCurveDeriv. Keeping the cubic in
// one place stops the four call sites (fill evalT, fill Newton, edge
// hermiteEdges, edge tangent) from drifting out of sync.
public float sBlend(float t)      { return t * t * (3.0 - 2.0 * t); }
public float sBlendDeriv(float t) { return 6.0 * t * (1.0 - t); }
public float yCurve(float t)      { return 1.5 * t * (1.0 - t) + t * t * t; }
public float yCurveDeriv(float t) { return 1.5 - 3.0 * t + 3.0 * t * t; }

// Screen-space (CSS px, top-left origin) → clip space, with the Y flip every
// synteny pass needs.
public float4 screenToClip(float2 screen, float2 resolution) {
  float2 clip = screen / resolution * 2.0 - 1.0;
  return float4(clip.x, -clip.y, 0.0, 1.0);
}

// Analytic coverage for a fill fragment. `localPos.x` is screen X, `localPos.y`
// is the vertical offset from yTop. `(xL,xR)` are the ribbon edges at this y and
// `perpFactor` the slope foreshortening. CIGAR tiles (`isCigar > 0.5`) get a
// hard cut so adjacent tiles meet cleanly under alpha blend; everything else
// gets smoothstep AA over the perpendicular distance.
public float fillCoverage(float2 localPos, float xL, float xR,
                          float perpFactor, float isCigar, float isMarker,
                          float h, float fadeThinAlignments) {
  float xC = (xL + xR) * 0.5;
  float perpDist = (localPos.x - xC) / perpFactor;
  // Both CIGAR tiles and whole-feature (base) ribbons keep a 0.5px half-width
  // floor (1px minimum visual footprint) so a sub-pixel ribbon stays a
  // locatable, rasterizable band rather than dropping between sample points.
  // Wide ribbons (halfWidth > floor) are unaffected.
  // NOTE: the floor only keeps a sub-pixel ribbon visible when the rasterizer
  // had ≥1px of geometry to fill (whole BASE ribbons do; a sub-pixel CIGAR tile
  // can still drop out — an accepted tradeoff, since CIGAR detail only shows
  // when zoomed in).
  float minHalf = 0.5;
  float halfPerpW = max((xR - xL) / (2.0 * perpFactor), minHalf);
  float cx;
  if (isCigar > 0.5) {
    cx = abs(perpDist) <= halfPerpW ? 1.0 : 0.0;
  } else {
    // Density-honest sub-pixel fade. The footprint floor above keeps a thin
    // BASE ribbon a ~1px band, but its opacity scales with the ribbon's
    // perpendicular (visual) width so a lone thin alignment fades gently and a
    // whole-genome tangle of them stops reading as hard full-opacity lines —
    // dense overlaps still accumulate via alpha blend. Using perpendicular
    // width (the same metric as halfPerpW, not horizontal span) means steep
    // diagonal ribbons — the crossing-line hairball of rearranged genomes —
    // fade by their true thinness rather than escaping via a wide x-span.
    // Ribbons ≥1px wide saturate widthFade at 1 and are unaffected.
    // SYNC: Canvas2DSyntenyRenderer's sub-pixel branch (entered only for
    // near-vertical ribbons, where perpFactor≈1) scales its centerline stroke
    // alpha by the equivalent max(width, WIDTH_FADE_FLOOR).
    // Markers are intentionally zero-width, so the density-honest fade is
    // skipped (widthFade=1) — they stay a crisp 1px tick at the 0.5px floor.
    // WIDTH_FADE_FLOOR keeps a lone sub-pixel ribbon locatable instead of
    // fading all the way to invisible (see its definition above). The fade
    // itself is opt-out (fadeThinAlignments) because a genuinely sparse
    // whole-genome comparison (e.g. distant-species synteny) can have every
    // real alignment sub-pixel, and the fade would wash the view out rather
    // than declutter it, with no UI way to recover full opacity otherwise.
    float widthFade = (isMarker > 0.5 || fadeThinAlignments < 0.5)
      ? 1.0
      : clamp((xR - xL) / perpFactor, WIDTH_FADE_FLOOR, 1.0);
    float aaPerp = max(fwidth(perpDist), 1e-4);
    cx = (1.0 - smoothstep(halfPerpW - aaPerp * 0.5,
                           halfPerpW + aaPerp * 0.5,
                           abs(perpDist))) * widthFade;
  }
  float ay = max(fwidth(localPos.y), 1e-4) * 0.5;
  float cy = smoothstep(-ay, ay, localPos.y)
           - smoothstep(h - ay, h + ay, localPos.y);
  return cx * cy;
}

// Fill fragment output: feature color with hover darkening + alpha boost,
// premultiplied by coverage.
// SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
// Canvas2DSyntenyRenderer.ts's hover branch.
// isCigar: 1.0 for indel quads drawn over a visible base block. Non-hovered
// indels are pre-blended with white at u.alpha and output fully opaque, so
// they visually fade like they're over a white background while still fully
// covering the base block (avoids double-fade against the base block color).
public float4 shadeFill(float4 color, float featureId, float coverage,
                        float isCigar, float isMarker, Uniforms u) {
  float3 rgb = color.rgb;
  // Markers carry their own fixed alpha (0.25) and ignore colorBy, global
  // display alpha, and hover — matching the legacy fixed context lines.
  if (isMarker > 0.5) {
    return float4(rgb, color.a * coverage);
  }
  bool isHovered = u.hoveredFeatureId > 0.0
    && abs(featureId - u.hoveredFeatureId) < 0.5;
  if (isCigar > 0.5) {
    // Pre-blend with white so the indel fades against white regardless of what
    // the base block drew. blendAlpha mirrors the original alpha formula so
    // hover (min(u.alpha*5, 0.35)) and normal (u.alpha) match origin/main.
    // Apply 0.7 darkening inside the blend — same order as the original formula
    // (darken first, then blend with white) so the hover color is identical.
    float blendAlpha = isHovered
      ? min(color.a * u.alpha * 5.0, 0.35)
      : color.a * u.alpha;
    float darken = isHovered ? 0.7 : 1.0;
    rgb = rgb * darken * blendAlpha + float3(1.0, 1.0, 1.0) * (1.0 - blendAlpha);
    return float4(rgb, color.a * coverage);
  }
  float baseAlpha = color.a * u.alpha;
  rgb *= isHovered ? 0.7 : 1.0;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  return float4(rgb, finalAlpha * coverage);
}

// Edge-pass fragment output: 1px antialiased black stroke at 0.4 alpha. `dist`
// is the signed perpendicular distance from the edge centerline in px.
public float4 edgeStrokeColor(float dist) {
  float aa = fwidth(dist);
  float edgeAlpha = 1.0 - smoothstep(0.5 - aa * 0.5, 0.5 + aa, abs(dist));
  return float4(0.0, 0.0, 0.0, edgeAlpha * 0.4);
}
